import { Distribution } from "@pulumi/aws/cloudfront";
import { Record } from "@pulumi/aws/route53";
import { BucketPolicy, BucketV2 } from "@pulumi/aws/s3";
import { S3BucketFolder } from "@pulumi/synced-folder";

// DeploymentConfig contains all required configuration.
export type DeploymentConfig = {
  region: string;
  builtDir: string;
  repos: MonoRepoConfig[];
};

// MonoRepoConfig contains specific configuration of monorepo.
export type MonoRepoConfig = {
  name: string;
  syncFolder: string;
  pricingClass: string;
  acmCertificateArn: string;
  domain: string;
  route53HostedZoneId: string;
};

// S3BucketOutput represents the output of setupS3Bucket.
export type S3BucketOutput = {
  bucket: BucketV2;
  syncedFolder: S3BucketFolder;
};

// CFDistributionOutput represents the output of setupCFDistribution.
export type CFDistributionOutput = {
  distribution: Distribution;
  bucketPolicy: BucketPolicy;
};

// Route53RecordOutput represents the output of setupRoute53Record.
export type Route53RecordOutput = Record;
