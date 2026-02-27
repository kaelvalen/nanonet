package mailer

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"strings"
)

type Config struct {
	Host     string
	Port     string
	User     string
	Password string
	From     string
}

type Mailer struct {
	cfg Config
}

func New(cfg Config) *Mailer {
	return &Mailer{cfg: cfg}
}

// Enabled returns false when SMTP is not configured.
func (m *Mailer) Enabled() bool {
	return m.cfg.Host != "" && m.cfg.User != "" && m.cfg.Password != ""
}

func (m *Mailer) SendPasswordReset(toEmail, resetURL string) error {
	subject := "NanoNet — Şifre Sıfırlama"
	body := buildResetEmail(toEmail, resetURL)
	return m.send(toEmail, subject, body)
}

func (m *Mailer) send(to, subject, htmlBody string) error {
	from := m.cfg.From
	if from == "" {
		from = m.cfg.User
	}

	header := strings.Builder{}
	header.WriteString(fmt.Sprintf("From: NanoNet <%s>\r\n", from))
	header.WriteString(fmt.Sprintf("To: %s\r\n", to))
	header.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	header.WriteString("MIME-Version: 1.0\r\n")
	header.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	header.WriteString("\r\n")
	header.WriteString(htmlBody)

	msg := []byte(header.String())
	addr := net.JoinHostPort(m.cfg.Host, m.cfg.Port)
	auth := smtp.PlainAuth("", m.cfg.User, m.cfg.Password, m.cfg.Host)

	// Port 465 → implicit TLS; 587/25 → STARTTLS
	if m.cfg.Port == "465" {
		return m.sendTLS(addr, auth, from, to, msg)
	}
	return smtp.SendMail(addr, auth, from, []string{to}, msg)
}

func (m *Mailer) sendTLS(addr string, auth smtp.Auth, from, to string, msg []byte) error {
	tlsCfg := &tls.Config{ServerName: m.cfg.Host}
	conn, err := tls.Dial("tcp", addr, tlsCfg)
	if err != nil {
		return err
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, m.cfg.Host)
	if err != nil {
		return err
	}
	defer client.Quit()

	if err = client.Auth(auth); err != nil {
		return err
	}
	if err = client.Mail(from); err != nil {
		return err
	}
	if err = client.Rcpt(to); err != nil {
		return err
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	_, err = w.Write(msg)
	if err != nil {
		return err
	}
	return w.Close()
}

func buildResetEmail(toEmail, resetURL string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0fbff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f0fbff;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,180,216,0.10);overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#00b4d8,#a78bfa);padding:32px;text-align:center;">
            <div style="display:inline-block;width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;line-height:48px;font-size:24px;margin-bottom:12px;">✦</div>
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">NanoNet</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Microservice Monitoring Platform</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b;font-weight:600;">Şifre Sıfırlama İsteği</h2>
            <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">
              <strong>%s</strong> hesabı için şifre sıfırlama talebinde bulundunuz.<br>
              Aşağıdaki butona tıklayarak yeni şifrenizi belirleyebilirsiniz.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="%s" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#00b4d8,#a78bfa);color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.2px;">
                Şifremi Sıfırla
              </a>
            </div>
            <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;line-height:1.6;">
              Buton çalışmıyorsa aşağıdaki bağlantıyı tarayıcınıza kopyalayın:
            </p>
            <p style="margin:0;font-size:11px;color:#00b4d8;word-break:break-all;">%s</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f1f5f9;background:#fafcff;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
              Bu bağlantı <strong>1 saat</strong> geçerlidir. Şifre sıfırlama talebinde bulunmadıysanız bu emaili görmezden gelin — hesabınız güvende.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`, toEmail, resetURL, resetURL)
}
