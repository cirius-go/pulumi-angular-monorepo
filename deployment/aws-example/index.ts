import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as model from "./model";
import * as util from "./util";
import * as synced_folder from "@pulumi/synced-folder";

const config = new pulumi.Config();

const DEFAULT_MONOREPO_CONFIG: model.MonoRepoConfig = {
  name: "example-repo",
  syncFolder: "browser",
  pricingClass: "PriceClass_200",
  acmCertificateArn: "example-acm-cert-arn",
  domain: "example-cirius-go.com",
  route53HostedZoneId: "example-hosted-zone-id",
};

const deploymentConfig =
  config.requireObject<model.DeploymentConfig>("deployment");

const setupS3BucketFolder = (
  repoCfg = DEFAULT_MONOREPO_CONFIG,
): model.S3BucketOutput => {
  const bucketName = util.mkResourceName(repoCfg.name);

  // create S3 bucket
  const bucket = new aws.s3.BucketV2(bucketName, {
    bucket: bucketName,
  });

  // configure S3 settings
  const ownershipControls = new aws.s3.BucketOwnershipControls(
    util.mkResourceName(repoCfg.name, "ownership-controls"),
    {
      bucket: bucket.bucket,
      rule: { objectOwnership: "BucketOwnerPreferred" },
    },
  );

  // to block public access directly through s3 api.
  const publicAccessBlock = new aws.s3.BucketPublicAccessBlock(
    util.mkResourceName(repoCfg.name, "public-access-block"),
    {
      bucket: bucket.bucket,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    },
  );

  // sync folder to created S3 bucket
  const syncedFolder = new synced_folder.S3BucketFolder(
    util.mkResourceName(repoCfg.name, "synced-folder"),
    {
      path: `${deploymentConfig.builtDir}/${pulumi.getStack()}/${repoCfg.name}/${repoCfg.syncFolder}`,
      bucketName: bucket.bucket,
      acl: "bucket-owner-full-control",
    },
    // only owner can modify these files
    { dependsOn: [ownershipControls, publicAccessBlock] },
  );

  return {
    bucket: bucket,
    syncedFolder: syncedFolder,
  };
};

const setupCloudFrontDistribution = (
  repoCfg = DEFAULT_MONOREPO_CONFIG,
  s3Output: model.S3BucketOutput,
): model.CFDistributionOutput => {
  // create origin access control for setup distribution later.
  const oac = new aws.cloudfront.OriginAccessControl(
    util.mkResourceName(repoCfg.name, "oac"),
    {
      name: util.mkResourceName(repoCfg.name, "oac"),
      originAccessControlOriginType: "s3",
      signingBehavior: "always",
      signingProtocol: "sigv4",
    },
  );

  const { bucket } = s3Output;
  const distribution = new aws.cloudfront.Distribution(
    util.mkResourceName(repoCfg.name, "cdn"),
    {
      enabled: true,
      origins: [
        // bind s3 bucket to previous access control origin.
        {
          originId: bucket.id,
          domainName: bucket.bucketRegionalDomainName,
          originAccessControlId: oac.id,
        },
      ],
      defaultCacheBehavior: {
        targetOriginId: bucket.id,
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD", "OPTIONS"],
        cachedMethods: ["GET", "HEAD", "OPTIONS"],
        cachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
        responseHeadersPolicyId: "67f7725c-6f97-4210-82d7-5512b31e9d03",
      },
      priceClass: repoCfg.pricingClass,
      customErrorResponses: [
        {
          errorCode: 404,
          responseCode: 200,
          responsePagePath: "/index.html",
        },
        {
          errorCode: 403,
          responseCode: 200,
          responsePagePath: "/index.html",
        },
      ],
      restrictions: { geoRestriction: { restrictionType: "none" } },
      viewerCertificate: {
        sslSupportMethod: "sni-only",
        cloudfrontDefaultCertificate: true,
        acmCertificateArn: repoCfg.acmCertificateArn,
      },
      aliases: [`${repoCfg.name}-${pulumi.getStack()}.${repoCfg.domain}`],
    },
  );

  // define new bucket policy to allow cloudfront to read from bucket.
  const bucketPolicy = new aws.s3.BucketPolicy(
    util.mkResourceName(repoCfg.name, "bucket-policy"),
    {
      bucket: bucket.bucket,
      policy: pulumi.all([bucket.arn, distribution.arn]).apply(([arn, dArn]) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "AllowCloudFrontRead",
              Effect: "Allow",
              Principal: { Service: "cloudfront.amazonaws.com" },
              Action: ["s3:GetObject"],
              Resource: [`${arn}/*`],
              Condition: {
                StringEquals: {
                  "AWS:SourceArn": dArn,
                },
              },
            },
          ],
        }),
      ),
    },
  );
  return {
    distribution: distribution,
    bucketPolicy: bucketPolicy,
  };
};

const setupRoute53Record = (
  repoCfg = DEFAULT_MONOREPO_CONFIG,
  cfDistribution: model.CFDistributionOutput,
): model.Route53RecordOutput => {
  const { distribution } = cfDistribution;
  return new aws.route53.Record(
    util.mkResourceName(repoCfg.name, "dns-record"),
    {
      zoneId: repoCfg.route53HostedZoneId,
      name: `${repoCfg.name}-${pulumi.getStack()}.${repoCfg.domain}`,
      type: "A",
      aliases: [
        {
          name: distribution.domainName,
          zoneId: distribution.hostedZoneId,
          evaluateTargetHealth: true,
        },
      ],
    },
  );
};

const setupMonoRepo = (repoCfg = DEFAULT_MONOREPO_CONFIG) => {
  const s3Output = setupS3BucketFolder(repoCfg);
  const cfDistributionOutput = setupCloudFrontDistribution(repoCfg, s3Output);
  const route53RecordOutput = setupRoute53Record(repoCfg, cfDistributionOutput);

  // invalidate cache after all.
  const { distribution, bucketPolicy } = cfDistributionOutput;
  const { bucket, syncedFolder } = s3Output;
  pulumi.all([distribution.id, syncedFolder]).apply(async ([dId]) => {
    await util.invalidateCFCache(dId, deploymentConfig.region);
  });

  // expose some information for deployment stage.
  return {
    bucketDomainName: bucket.bucketRegionalDomainName,
    bucketCFDistributionPolicy: bucketPolicy,
    distributionId: distribution.id,
    dnsRecordId: route53RecordOutput.id,
  };
};

export const output = deploymentConfig.repos.map(setupMonoRepo);
