const express = require('express');
const router = express.Router();

router.get('/search', async (req, res) => {
  const { query, type = 'skills', industry, limit = 10 } = req.query;
  
  if (!query || query.length < 2) {
    return res.json([]);
  }

  try {
    // Textkernel Skills API
    const apiKey = process.env.TEXTKERNEL_API_KEY;
    const response = await fetch(
      `https://api.textkernel.com/skills/v1/search?q=${encodeURIComponent(query)}&limit=${limit}&lang=en`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Textkernel API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform to your format
    const skills = data.skills?.map(skill => ({
      id: skill.id,
      name: skill.preferredLabel || skill.name,
      description: skill.description,
      industry: skill.occupationType || skill.industry,
      level: skill.skillLevel
    })) || [];

    // Filter by industry if specified (Space, Tech, etc.)
    if (industry) {
      const filtered = skills.filter(s => 
        s.industry?.toLowerCase().includes(industry.toLowerCase())
      );
      res.json(filtered.slice(0, limit));
    } else {
      res.json(skills);
    }

  } catch (error) {
    console.error('Textkernel error:', error);
    // Fallback: Local cached skills (implement later)
    res.json([]);
  }
});

module.exports = router;
