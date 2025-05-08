import * as pulumi from "@pulumi/pulumi";
import * as cloudfront from "@aws-sdk/client-cloudfront";

// mkResourceName create resource name for specific monorepo based on stack and
// project name from pulumi context.
// {project-name}-{stack}-{monorepo-name} + optional -{resource}
// example:
// cms -> pulumi-angular-monorepo-dev-cms
// barebone -> pulumi-angular-monorepo-dev-barebone
// cms, s3-bucket -> pulumi-angular-monorepo-dev-cms-s3-bucket
export const mkResourceName = (monorepoName: string, resource?: string) => {
  const elems = [pulumi.getProject(), pulumi.getStack(), monorepoName];
  if (resource) elems.push(resource);
  return elems.join("-");
};

// invalidateCFCache in order to serve new version of file.
export const invalidateCFCache = async (
  cfDistributionId: string,
  region: string,
) => {
  const cf = new cloudfront.CloudFront({
    region: region,
  });

  const command = new cloudfront.CreateInvalidationCommand({
    DistributionId: cfDistributionId,
    InvalidationBatch: {
      Paths: { Quantity: 1, Items: ["/*"] },
      CallerReference: `${Date.now()}`,
    },
  });

  try {
    const response = await cf.send(command);
    console.log(" Invalidation created:", response.Invalidation?.Id);
  } catch (error) {
    console.error(" Error invalidating cache:", error);
  }
};
