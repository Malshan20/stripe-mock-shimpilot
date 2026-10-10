// Scan-only review cases: no resource creation, invocation, or schema changes.
import AWS from 'aws-sdk';
export async function readDocument(table:string,id:string) {
  const document=new AWS.DynamoDB.DocumentClient({region:'us-east-1'});
  return document.get({TableName:table,Key:{id}}).promise();
}
export async function invokeExistingLambda(functionName:string) {
  const lambda=new AWS.Lambda({region:'us-east-1'});
  return lambda.invoke({FunctionName:functionName,InvocationType:'RequestResponse',Payload:'{}'}).promise();
}
