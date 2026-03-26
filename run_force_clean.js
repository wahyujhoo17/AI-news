const axios = require('axios')
const Parser = require('rss-parser')
const { pool } = require('./lib/db-worker')

async function fetchFirstGoogleNews(){
  const parser = new Parser()
  const feed = await parser.parseURL('https://news.google.com/rss')
  if(feed.items && feed.items.length>0) return feed.items[0]
  throw new Error('no items')
}

async function callGroq(prompt){
  const key = process.env.GROQ_API_KEY
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
  if(!key) throw new Error('GROQ_API_KEY missing')
  const res = await axios.post('https://api.groq.com/openai/v1/responses', { model, input: prompt, max_output_tokens: 1200, temperature: 0.6 }, { headers: { Authorization: , 'Content-Type':'application/json' }, timeout:90000 })
  return res.data
}

function extractTextFromResponse(data){
  if(!data) return ''
  if(data.output_text) return data.output_text
  if(Array.isArray(data.output)){
    return data.output.map(o=> typeof o==='string'? o : (o.content? (Array.isArray(o.content)? o.content.map(c=>c.text||'').join('') : o.content.text||'') : '') ).join('\n')
  }
  if(data.choices && data.choices[0]) return data.choices[0].text || data.choices[0].message?.content || ''
  return JSON.stringify(data)
}

async function run(){
  try{
    const item = await fetchFirstGoogleNews()
    console.log('Selected item:', item.title)
    const snippet = (item.contentSnippet || item.content || item.title || '').slice(0,1500)
    const prompt = 
    console.log('Calling Groq...')
    const data = await callGroq(prompt)
    const text = extractTextFromResponse(data)
    console.log('Generated length', text.length)
    const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
    const title = lines[0] || item.title
    const excerpt = lines[1] || (text.split('. ').slice(0,2).join('. ') + '.')
    const body = lines.slice(2).join('\n\n') || text
    // insert into DB
    const now = new Date().toISOString()
    const saved = await pool.query(, [title, body, item.link, 'GoogleNews', now, true, process.env.GROQ_MODEL||'openai/gpt-oss-20b', 0,0,0,0.0, excerpt, 'AI News Editor'])
    console.log('Inserted:', saved.rows[0])
    process.exit(0)
  }catch(err){
    console.error('Error:', err.message)
    if(err.response && err.response.data) console.error('Resp:', JSON.stringify(err.response.data))
    process.exit(1)
  }
}

run()
