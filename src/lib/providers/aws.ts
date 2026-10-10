import AWS from 'aws-sdk';
import { mode, required } from '../config';
import type { Project } from '../db';
export async function exportToCloud(userId:string,projects:Project[]) {
  const key=`demo/${userId}/${crypto.randomUUID()}.json`;
  if(mode('aws')==='mock') return {key,bytes:Buffer.byteLength(JSON.stringify(projects)),mode:'mock'};
  // POSITIVE CASE: actual v2 client and .promise() contract; v3 needs a service package.
  const s3=new AWS.S3({region:process.env.AWS_REGION || 'us-east-1',maxRetries:1,httpOptions:{timeout:15000}});
  await s3.putObject({Bucket:required('AWS_S3_BUCKET'),Key:key,Body:JSON.stringify(projects),ContentType:'application/json'}).promise();
  return {key,bytes:Buffer.byteLength(JSON.stringify(projects)),mode:'remote'};
}
