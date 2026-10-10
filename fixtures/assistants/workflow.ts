// Scan-only. Complex sunset workflow, not a one-call rename.
import OpenAI from 'openai';
export async function legacyAssistant() {
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const assistant=await client.beta.assistants.create({name:'Demo assistant',model:'gpt-4o-mini',instructions:'Summarize a software release.'});
  const thread=await client.beta.threads.create();
  await client.beta.threads.messages.create(thread.id,{role:'user',content:'Summarize the release'});
  return client.beta.threads.runs.create(thread.id,{assistant_id:assistant.id});
}
