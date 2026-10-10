import { Configuration, OpenAIApi } from 'openai';
import { mode, required } from '../config';
// POSITIVE CASE: initialization and Axios response.data both change in SDK v4.
export function openaiClient() {
  const client=new OpenAIApi(new Configuration({apiKey:required('OPENAI_API_KEY')}));
  return client;
}
export async function summarize(text:string) {
  if(mode('openai')==='mock') return {text:`[Mock AI] ${text.slice(0,180)}${text.length>180?'…':''} — ready for the next release.`,mode:'mock'};
  const client=new OpenAIApi(new Configuration({apiKey:required('OPENAI_API_KEY'),basePath:process.env.OPENAI_BASE_URL}));
  const result=await client.createChatCompletion({model:process.env.OPENAI_MODEL || 'gpt-4o-mini',messages:[{role:'system',content:'Summarize the project in two concise sentences.'},{role:'user',content:text}],max_tokens:200,temperature:0.3},{timeout:30000});
  return {text:result.data.choices[0]?.message?.content ?? '',mode:'remote'};
}
export async function embed(text:string) {
  if(mode('openai')==='mock') return {dimensions:8,preview:[0.12,0.08,-0.04,0.15],mode:'mock'};
  const client=new OpenAIApi(new Configuration({apiKey:required('OPENAI_API_KEY'),basePath:process.env.OPENAI_BASE_URL}));
  const result=await client.createEmbedding({model:'text-embedding-3-small',input:text},{timeout:30000});
  const values=result.data.data[0].embedding;
  return {dimensions:values.length,preview:values.slice(0,4),mode:'remote'};
}
export async function moderate(text:string) {
  if(mode('openai')==='mock') return {flagged:false,mode:'mock'};
  const client=new OpenAIApi(new Configuration({apiKey:required('OPENAI_API_KEY'),basePath:process.env.OPENAI_BASE_URL}));
  const result=await client.createModeration({input:text,model:'omni-moderation-latest'},{timeout:30000});
  return {flagged:result.data.results[0].flagged,mode:'remote'};
}
