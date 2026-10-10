"""Optional scan-only Python ecosystem cases. Not part of the Next.js runtime."""
import os
import openai
import anthropic

def old_summary(text):
    openai.api_key = os.environ.get("OPENAI_API_KEY")
    response = openai.ChatCompletion.create(model="gpt-3.5-turbo", messages=[{"role": "user", "content": text}])
    return response["choices"][0]["message"]["content"]

def old_embedding(text):
    return openai.Embedding.create(model="text-embedding-ada-002", input=text)

def retired_claude(text):
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    return client.messages.create(model="claude-3-5-sonnet-20241022",max_tokens=100,messages=[{"role":"user","content":text}])
