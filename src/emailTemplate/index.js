require("dotenv").config();
module.exports = {
  otpEmail: (otp) => {
    const expiryMinutes = process.env.OTP_EXPIRE_MINUTES;

    return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Your OTP Code</title>
      </head>
      <body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#f4f4f4;">
        <div style="max-width:600px; margin:40px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background:#007bff; padding:20px; text-align:center; color:#fff;">
            <h1 style="margin:0; font-size:24px;">OTP Verification</h1>
          </div>

          <!-- Body -->
          <div style="padding:30px; text-align:center;">
            <p style="font-size:18px; color:#333; margin-bottom:15px;">
              Hello,<br/> Use the OTP below to reset your password.
            </p>

            <!-- OTP Box -->
            <div style="font-size:28px; font-weight:bold; letter-spacing:8px; background:#f1f1f1; padding:15px; border-radius:8px; display:inline-block; margin:20px 0;">
              ${otp}
            </div>

            <p style="font-size:16px; color:#555; margin-bottom:20px;">
              This OTP will expire in <strong>${expiryMinutes} minutes</strong>.
            </p>

            <p style="font-size:14px; color:#777; line-height:1.5;">
              If you did not request this, you can safely ignore this email.
            </p>
          </div>

          <!-- Footer -->
          <div style="background:#f9f9f9; padding:15px; text-align:center; font-size:12px; color:#999;">
            &copy; ${new Date().getFullYear()} Your Company. All rights reserved.
          </div>
        </div>
      </body>
    </html>
    `;
  },
};
