<!DOCTYPE html>
<html>
<body style="font-family:Arial,Helvetica,sans-serif;color:#1F2937;line-height:1.5;">
  <h2 style="color:#C8202F;margin-bottom:4px;">Final Notice: Unpaid Traffic Ticket</h2>
  <p>Dear {{ $name ?: 'Sir/Madam' }},</p>
  <p>
    Our records show that traffic ticket <strong>{{ $ticket->ticket_number }}</strong>
    was not paid within the 72-hour payment period
    (deadline: <strong>{{ $dueAt->format('M d, Y h:i A') }}</strong>).
  </p>
  <table cellpadding="6" style="border-collapse:collapse;border:1px solid #E3E7EE;">
    <tr><td>Ticket No.</td><td><strong>{{ $ticket->ticket_number }}</strong></td></tr>
    <tr><td>Outstanding balance</td><td><strong>₱{{ number_format($balance, 2) }}</strong></td></tr>
    <tr><td>Payment deadline</td><td>{{ $dueAt->format('M d, Y h:i A') }}</td></tr>
  </table>
  <p>
    Please settle this ticket at the traffic office as soon as possible.
    If it remains unpaid by <strong>{{ $warrantAt->format('M d, Y') }}</strong>,
    a warrant visit will be scheduled at your residence.
  </p>
  <p>If you have already paid, please disregard this message.</p>
  <p>Thank you.</p>
</body>
</html>