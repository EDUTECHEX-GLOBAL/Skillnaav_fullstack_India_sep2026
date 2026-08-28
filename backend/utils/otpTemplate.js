const generateOtpEmailHtml = (otp, type = "signing in to your SkillNaav account") => {
  const otpBlocks = String(otp).split('').map(digit => 
    `<span style="display: inline-block; width: 32px; height: 40px; line-height: 40px; background-color: #f4f5f7; margin: 0 4px; border-radius: 6px; font-size: 20px; font-weight: bold; color: #1a202c; box-shadow: 0 1px 2px rgba(0,0,0,0.05); text-align: center;">${digit}</span>`
  ).join('');

  return `
    <h2 style="color: #1a202c; font-size: 22px; font-weight: 700; margin: 0 0 5px;">Verify it's you</h2>
    <p style="color: #6b7280; font-size: 14px; margin: 0 0 15px; line-height: 1.5;">Enter this one-time code to continue ${type}.</p>
    
    <div style="margin: 15px 0;">
      ${otpBlocks}
    </div>
    
    <p style="color: #f43f5e; font-size: 11px; font-weight: 700; letter-spacing: 1px; margin: 15px 0 20px;">EXPIRES IN 10 MINUTES</p>
    
    <a href="${process.env.FRONTEND_BASE_URL || 'https://skillnaav.com'}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(90deg, #d946ef, #f97316); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.25);">
      Open SkillNaav
    </a>
  `;
};

module.exports = { generateOtpEmailHtml };
