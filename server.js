const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Funzione per ricavare automaticamente l'URL corretto del server su Render
function getOAuthClient(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const redirectUri = `${protocol}://${host}/api/auth/google/callback`;

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

let userTokens = null;

if (process.env.GOOGLE_REFRESH_TOKEN) {
  // Se c'è il token fisso salvato su Render, lo usiamo
}

// 1. Rotta per avviare il login
app.get('/auth/google', (req, res) => {
  const oauth2Client = getOAuthClient(req);
  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/tasks'
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  res.redirect(url);
});

// 2. Callback di Google
app.get('/api/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  const oauth2Client = getOAuthClient(req);
  try {
    const { tokens } = await oauth2Client.getToken(code);
    userTokens = tokens;
    res.send(`
      <div style="font-family:sans-serif; padding:30px; text-align:center;">
        <h2 style="color: green;">Autenticazione riuscita con successo!</h2>
        <p>Copia questo <b>refresh_token</b> e incollalo nelle variabili d'ambiente di Render col nome <b>GOOGLE_REFRESH_TOKEN</b>:</p>
        <textarea style="width:100%; max-width:600px; height:100px; font-family:monospace; padding:10px;">${tokens.refresh_token || 'Token già attivo o non rigenerato'}</textarea>
        <p style="margin-top:20px; color:#666;">Ora puoi chiudere questa pagina e aggiornare la tua dashboard su Canva.</p>
      </div>
    `);
  } catch (error) {
    console.error('Errore callback:', error);
    res.status(500).send('Autenticazione fallita.');
  }
});

// Funzione interna per autenticare le richieste a Google
function getClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  if (process.env.GOOGLE_REFRESH_TOKEN) {
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return oauth2Client;
  }
  if (userTokens) {
    oauth2Client.setCredentials(userTokens);
    return oauth2Client;
  }
  return null;
}

// 3. Endpoint Eventi Calendario per Canva
app.get('/api/events', async (req, res) => {
  try {
    const client = getClient();
    if (!client) {
      return.status(401).json({ error: 'Non autenticato. Vai prima su /auth/google' });
    }
    const calendar = google.calendar({ version: 'v3', auth: client });
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: (new Date()).toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });
    res.json(response.data.items);
  } catch (error) {
    console.error('Errore eventi:', error);
    res.status(500).json({ error: 'Impossibile recuperare gli eventi' });
  }
});

// 4. Endpoint Google Tasks per Canva
app.get('/api/tasks', async (req, res) => {
  try {
    const client = getClient();
    if (!client) {
      return res.status(401).json({ error: 'Non autenticato. Vai prima su /auth/google' });
    }
    const service = google.tasks({ version: 'v1', auth: client });
    const listsResponse = await service.tasklists.list({ maxResults: 1 });
    const taskLists = listsResponse.data.items;
    
    if (!taskLists || taskLists.length === 0) {
      return res.json({ listTitle: 'Nessuna lista', items: [] });
    }

    const tasksResponse = await service.tasks.list({
      taskList: taskLists[0].id,
      showCompleted: true,
    });

    res.json({
      listTitle: taskLists[0].title,
      items: tasksResponse.data.items || []
    });
  } catch (error) {
    console.error('Errore task:', error);
    res.status(500).json({ error: 'Impossibile recuperare i task' });
  }
});

app.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}`);
});
