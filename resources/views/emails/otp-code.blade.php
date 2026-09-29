<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $purpose === 'password_reset' ? 'Password Reset Code' : 'Login Verification Code' }}</title>
</head>
<body style="margin:0;padding:0;background:#F5F6F8;font-family:Arial,Helvetica,sans-serif;color:#1F2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F6F8;padding:32px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                    <tr>
                        <td style="background:#16233F;padding:28px 32px;">
                            <div style="color:#F0B429;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">
                                City of El Salvador
                            </div>
                            <div style="color:#ffffff;font-size:22px;font-weight:bold;line-height:1.2;">
                                TEMU Traffic System
                            </div>
                            <div style="color:#A9B3C9;font-size:12px;margin-top:4px;">
                                Traffic Enforcement and Management Unit
                            </div>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:32px;">
                            <p style="margin:0 0 16px;font-size:15px;color:#1F2937;">
                                Hi {{ $firstName }},
                            </p>

                            @if ($purpose === 'password_reset')
                                <p style="margin:0 0 24px;font-size:14px;color:#4B5563;line-height:1.5;">
                                    We received a request to reset your TEMU password.
                                    Use the code below to continue.
                                </p>
                            @else
                                <p style="margin:0 0 24px;font-size:14px;color:#4B5563;line-height:1.5;">
                                    Use the code below to finish signing in to your TEMU account.
                                </p>
                            @endif

                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                                <tr>
                                    <td style="background:#FBF1DC;border:1px solid #F0B429;border-radius:12px;padding:20px 32px;">
                                        <div style="font-family:'Courier New',monospace;font-size:36px;font-weight:bold;color:#16233F;letter-spacing:8px;text-align:center;">
                                            {{ $code }}
                                        </div>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:0 0 16px;font-size:13px;color:#64748B;text-align:center;">
                                This code expires in <strong style="color:#16233F;">{{ $ttlMinutes }} minutes</strong>.
                            </p>

                            <p style="margin:0;font-size:12px;color:#94A3B8;line-height:1.5;padding-top:16px;border-top:1px solid #E9ECF2;">
                                If you didn't request this code, you can safely ignore this email.
                                Someone may have typed your email address by mistake.
                                Never share this code with anyone — TEMU staff will never ask for it.
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td style="background:#F8F9FA;padding:16px 32px;border-top:1px solid #E9ECF2;">
                            <p style="margin:0;font-size:11px;color:#94A3B8;text-align:center;">
                                &copy; {{ date('Y') }} TEMU · El Salvador City, Philippines
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>