<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Your TEMU Account</title>
</head>
<body style="margin:0; padding:0; background:#F5F6F8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color:#1F2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F5F6F8; padding:32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 14px rgba(0,0,0,0.06);">

                    <!-- Header -->
                    <tr>
                        <td style="background:#16233F; padding:28px 32px;">
                            <p style="margin:0; color:#F0B429; font-size:11px; letter-spacing:2px; text-transform:uppercase;">
                                City of El Salvador
                            </p>
                            <h1 style="margin:6px 0 0 0; color:#ffffff; font-size:22px; font-weight:700;">
                                Welcome to TEMU
                            </h1>
                            <p style="margin:4px 0 0 0; color:#A9B3C9; font-size:13px;">
                                Traffic Enforcement and Management Unit
                            </p>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:28px 32px;">
                            <p style="margin:0 0 14px 0; font-size:15px;">
                                Hi <strong>{{ $user->firstname }}</strong>,
                            </p>
                            <p style="margin:0 0 18px 0; font-size:14px; line-height:1.6; color:#475569;">
                                Your TEMU account has been created with the role
                                <strong style="color:#16233F;">{{ ucfirst($user->role) }}</strong>.
                                Use the credentials below to sign in.
                            </p>

                            <!-- Credentials box -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F8F9FA; border:1px solid #E9ECF2; border-radius:10px; margin-bottom:20px;">
                                <tr>
                                    <td style="padding:18px 20px;">
                                        <p style="margin:0 0 6px 0; font-size:11px; letter-spacing:1px; text-transform:uppercase; color:#64748B;">
                                            Email
                                        </p>
                                        <p style="margin:0 0 16px 0; font-size:15px; font-family: ui-monospace, Menlo, monospace; color:#16233F; word-break:break-all;">
                                            {{ $user->email }}
                                        </p>

                                        <p style="margin:0 0 6px 0; font-size:11px; letter-spacing:1px; text-transform:uppercase; color:#64748B;">
                                            Temporary Password
                                        </p>
                                        <p style="margin:0; font-size:20px; font-weight:700; letter-spacing:3px; font-family: ui-monospace, Menlo, monospace; color:#16233F;">
                                            {{ $plainPassword }}
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:0 0 20px 0; font-size:13px; color:#C8202F; background:#FBE7E9; border-radius:8px; padding:10px 14px;">
                                <strong>Important:</strong> Please change your password after your first sign-in.
                            </p>

                            @if ($loginUrl)
                                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;">
                                    <tr>
                                        <td style="background:#1E8449; border-radius:8px;">
                                            <a href="{{ $loginUrl }}"
                                               style="display:inline-block; padding:12px 26px; color:#ffffff; text-decoration:none; font-weight:600; font-size:14px;">
                                                Sign In to TEMU
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            @endif

                            <p style="margin:0; font-size:12px; color:#94A3B8; line-height:1.6;">
                                If you did not expect this email, please contact your system administrator.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background:#F8F9FA; padding:16px 32px; border-top:1px solid #E9ECF2;">
                            <p style="margin:0; font-size:11px; color:#94A3B8;">
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