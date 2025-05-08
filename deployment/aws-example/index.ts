import * as cloudfront from "@aws-sdk/client-cloudfront";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as synced_folder from "@pulumi/synced-folder";

import * as model from "./model";

// Load configuration
const config = new pulumi.Config();

const deploymentConfig =
  config.requireObject<model.DeploymentConfig>("deployment");

const cf = new cloudfront.CloudFront({
  region: deploymentConfig.region,
});
const invalidateCache = async (distributionId: string) => {
  const command = new cloudfront.CreateInvalidationCommand({
    DistributionId: distributionId,
    InvalidationBatch: {
      Paths: { Quantity: 1, Items: ["/*"] },
      CallerReference: `${Date.now()}`,
    },
  });

  try {
    const response = await cf.send(command);
    console.log("✅ Invalidation created:", response.Invalidation?.Id);
  } catch (error) {
    console.error("❌ Error invalidating cache:", error);
  }
};

// Utility function for naming consistency
const getResourceName = (repo: string, resource?: string) => {
  const elems = [pulumi.getProject(), pulumi.getStack(), repo];
  if (resource) elems.push(resource);
  return elems.join("-");
};

// Define the setup function
const setupMonoRepos = (monorepo: model.MonoRepoConfig) => {
  const bucketName = getResourceName(monorepo.repo);

  // Create S3 bucket
  const bucket = new aws.s3.BucketV2(bucketName, {
    bucket: bucketName,
  });

  // Configure S3 settings
  const ownershipControls = new aws.s3.BucketOwnershipControls(
    getResourceName(monorepo.repo, "ownership-controls"),
    {
      bucket: bucket.bucket,
      rule: { objectOwnership: "BucketOwnerPreferred" },
    },
  );

  const publicAccessBlock = new aws.s3.BucketPublicAccessBlock(
    getResourceName(monorepo.repo, "public-access-block"),
    {
      bucket: bucket.bucket,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    },
  );

  // Sync folder to S3 bucket
  const bucketFolder = new synced_folder.S3BucketFolder(
    getResourceName(monorepo.repo, "sync-content"),
    {
      path: `${deploymentConfig.buildDir}/${pulumi.getStack()}/${monorepo.repo}/browser`,
      bucketName: bucket.bucket,
      acl: "bucket-owner-full-control",
    },
    { dependsOn: [ownershipControls, publicAccessBlock] },
  );

  const oac = new aws.cloudfront.OriginAccessControl(
    getResourceName(monorepo.repo, "oac"),
    {
      name: getResourceName(monorepo.repo, "oac"),
      originAccessControlOriginType: "s3",
      signingBehavior: "always",
      signingProtocol: "sigv4",
    },
  );

  // Create CloudFront Distribution
  const distribution = new aws.cloudfront.Distribution(
    getResourceName(monorepo.repo, "cdn"),
    {
      enabled: true,
      origins: [
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
      priceClass: deploymentConfig.pricingClass,
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
        acmCertificateArn: deploymentConfig.certificateArn,
      },
      aliases: [
        `${monorepo.repo}-${pulumi.getStack()}.${deploymentConfig.domain}`,
      ],
    },
  );

  const dnsRecord = new aws.route53.Record(
    getResourceName(monorepo.repo, "dns-record"),
    {
      zoneId: deploymentConfig.hostedZoneId,
      name: `${monorepo.repo}-${pulumi.getStack()}.${deploymentConfig.domain}`,
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

  const bucketPolicy = new aws.s3.BucketPolicy(
    getResourceName(monorepo.repo, "bucket-policy"),
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

  pulumi.all([distribution.id, bucketFolder]).apply(async ([dId]) => {
    await invalidateCache(dId);
  });

  return {
    bucketDomainName: bucket.bucketRegionalDomainName,
    bucketPolicy: bucketPolicy,
    cdn: distribution.id,
    dnsRecordId: dnsRecord.name,
  };
};

export const output = deploymentConfig.repos.map(setupMonoRepos);
