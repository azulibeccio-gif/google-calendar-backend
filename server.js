const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://mio-backend-calendar.onrender.com/api/auth/google/callback'
);

let userTokens = null;

// Rotta di autenticazione con i permessi completi per i task
app.get('/auth/google', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/tasks' // <-- Permesso completo richiesto da Canva
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  res.redirect(url);
});

app.get('/api/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    userTokens = tokens;
    oauth2Client.setCredentials(tokens);
    res.send('Autenticazione riuscita! Puoi chiudere questa pagina.');
  } catch (error) {
    res.status(500).send('Autenticazione fallita.');
  }
});

// Endpoint Eventi Calendar
app.get('/api/events', async (req, res) => {
  try {
    if (!userTokens) return res.status(401).json({ error: 'Non autenticato' });
    oauth2Client.setCredentials(userTokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: (new Date()).toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });
    res.json(response.data.items);
  } catch (error) {
    res.status(500).json({ error: 'Errore eventi' });
  }
});

// Endpoint Google Tasks formattato esattamente come richiesto da Canva
app.get('/api/tasks', async (req, res) => {
  try {
    if (!userTokens) {
      return res.status(401).json({ error: 'Non autenticato' });
    }

    oauth2Client.setCredentials(userTokens);
    const tasksService = google.tasks({ version: 'v1', auth: oauth2Client });
    
    // 1. Recupera gli elenchi task dell'utente (@me/lists)
    const listsResponse = await tasksService.tasklists.list();
    const taskLists = listsResponse.data.items;

    if (!taskLists || taskLists.length === 0) {
      return res.json([]);
    }

    let flatTasksList = [];

    // 2. Per ogni elenco, recupera le task e arricchiscile con listId e listName
    for (const list of taskLists) {
      const tasksResponse = await tasksService.tasks.list({
        taskList: list.id,
        showCompleted: true,
        showDeleted: true,
      });

      const tasks = tasksResponse.data.items || [];

      for (const task of tasks) {
        flatTasksList.push({
          listId: list.id,
          listName: list.title, // <-- Fondamentale per il match con il progetto
          taskId: task.id,
          title: task.title,
          status: task.status, // 'needsAction' o 'completed'
          due: task.due || null,
          deleted: task.deleted || false
        });
      }
    }

    // 3. Restituisce l'array piatto richiesto da Canva
    res.json(flatTasksList);
  } catch (error) {
    console.error('Errore nel recupero dei task:', error);
    res.status(500).json({ error: 'Impossibile recuperare i task' });
  }
});

app.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}`);
});
