/**
 * One-shot OAuth setup for the Gmail sender account.
 *
 * Asks for CLIENT_ID and CLIENT_SECRET, spins up a local server on :3000,
 * prints an authorization URL. After you accept the consent in the browser,
 * Google redirects to http://localhost:3000/oauth2callback with a code,
 * the script exchanges it for tokens and prints the refresh token.
 *
 * Run: npm run gmail:oauth
 */
import { google } from 'googleapis'
import http from 'http'
import { URL } from 'url'
import readline from 'readline'

const PORT = 3000
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`
const SCOPES = ['https://www.googleapis.com/auth/gmail.modify']

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function main() {
  console.log('\n=== Gmail OAuth Setup ===\n')

  const clientId = process.env.GOOGLE_CLIENT_ID || (await prompt('GOOGLE_CLIENT_ID: '))
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET || (await prompt('GOOGLE_CLIENT_SECRET: '))

  if (!clientId || !clientSecret) {
    console.error('CLIENT_ID y CLIENT_SECRET son obligatorios.')
    process.exit(1)
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // fuerza que Google devuelva refresh_token aunque ya hayas autorizado antes
  })

  console.log('\n1) Asegurate de estar logueado en el navegador con el email que registraste como Test User.')
  console.log('2) Abrí este link:\n')
  console.log(authUrl)
  console.log('\n3) Aceptá los permisos. Google redirige a localhost y este script captura el code.\n')
  console.log(`Esperando la redirección en http://localhost:${PORT}/oauth2callback...\n`)

  await new Promise<void>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url) {
        res.writeHead(400)
        res.end('bad request')
        return
      }

      const url = new URL(req.url, `http://localhost:${PORT}`)
      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404)
        res.end('not found')
        return
      }

      const error = url.searchParams.get('error')
      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<h1>Error de autorización</h1><p>${error}</p>`)
        server.close()
        reject(new Error(`OAuth error: ${error}`))
        return
      }

      const code = url.searchParams.get('code')
      if (!code) {
        res.writeHead(400)
        res.end('missing code')
        return
      }

      try {
        const { tokens } = await oauth2Client.getToken(code)

        if (!tokens.refresh_token) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(
            `<h1>Faltó refresh_token</h1><p>Google no devolvió refresh_token. ` +
              `Esto suele pasar cuando ya autorizaste antes. Revocá el acceso en ` +
              `<a href="https://myaccount.google.com/permissions">https://myaccount.google.com/permissions</a> ` +
              `y corré el script de nuevo.</p>`
          )
          server.close()
          reject(new Error('No refresh token returned'))
          return
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(
          `<html><body style="font-family: sans-serif; padding: 40px; background: #f9fafb;">` +
            `<h1 style="color: #16a34a;">✓ Autorización exitosa</h1>` +
            `<p>Volvé a la terminal para copiar las env vars.</p>` +
            `</body></html>`
        )

        console.log('\n✓ Tokens recibidos.\n')
        console.log('=== COPIÁ ESTAS ENV VARS EN RAILWAY ===\n')
        console.log(`GOOGLE_CLIENT_ID=${clientId}`)
        console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`)
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`)
        console.log(`GMAIL_SENDER_EMAIL=<el email con el que aceptaste la autorización>`)
        console.log('\nAcordate de redeployar Railway después de pegarlas.\n')

        server.close()
        resolve()
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<h1>Error intercambiando code por tokens</h1><pre>${String(err)}</pre>`)
        server.close()
        reject(err)
      }
    })

    server.listen(PORT, () => {
      // ready
    })
  })
}

main().catch((err) => {
  console.error('\nFalló:', err?.message ?? err)
  process.exit(1)
})
