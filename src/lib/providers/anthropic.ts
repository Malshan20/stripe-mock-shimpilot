import Anthropic from '@anthropic-ai/sdk';
import { mode, required } from '../config';
export async function legacyReview(text:string) {
  if(mode('anthropic')==='mock') return {text:'[Mock Claude] This project has clear goals. Review provider dependencies before shipping.',mode:'mock',fixture:'retired-model'};
  const client=new Anthropic({apiKey:required('ANTHROPIC_API_KEY'),timeout:30000,maxRetries:0});
  // DELIBERATE retired literal: remote calls may fail, which is expected for this fixture.
  const response=await client.messages.create({model:'claude-3-5-sonnet-20241022',max_tokens:160,messages:[{role:'user',content:text}]});
  return {text:response.content.filter(x=>x.type==='text').map(x=>x.text).join('\n'),mode:'remote',fixture:'retired-model'};
}
