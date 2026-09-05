export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({error:"Method not allowed"});
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(503).json({error:"AI service not configured"});
  try {
    const { message, context } = req.body || {};
    if (!message || typeof message !== "string") return res.status(400).json({error:"Message required"});
    const safeContext = JSON.stringify({
      owner: context?.owner, role: context?.role, email: context?.email, github: context?.github,
      projects: (context?.projects||[]).slice(0,50).map(x=>({title:x.title,description:x.description,tags:x.tags,url:x.url})),
      blogs: (context?.blogs||[]).slice(0,50).map(x=>({title:x.title,description:x.description,tags:x.tags,url:x.url})),
      media: (context?.media||[]).slice(0,100)
    });
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method:"POST",
      headers:{
        "Authorization":`Bearer ${key}`,
        "Content-Type":"application/json",
        "HTTP-Referer":process.env.SITE_ORIGIN || "https://example.com",
        "X-Title":"Obaid's Laboratory"
      },
      body:JSON.stringify({
        model:process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        temperature:.25,
        messages:[
          {role:"system",content:`You are the Laboratory Assistant for Obaid's Laboratory. Answer only from the supplied public context. Do not invent personal, sensitive, private, financial, medical, authentication, or unrelated information. Be concise, practical and friendly. For contact requests provide the public email and clickable links when present. When relevant, return direct public media URLs from context so the frontend can make them clickable. Context: ${safeContext}`},
          {role:"user",content:message}
        ]
      })
    });
    const data=await response.json();
    if(!response.ok) return res.status(502).json({error:"Upstream AI error"});
    const reply=data?.choices?.[0]?.message?.content || "I could not find a useful answer.";
    return res.status(200).json({reply});
  } catch {
    return res.status(500).json({error:"Unexpected server error"});
  }
}
