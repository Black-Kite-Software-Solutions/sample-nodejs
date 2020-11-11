require('dotenv').config();
const NodeCache = require('node-cache');
const express = require('express');
const request = require('request-promise-native');
const app = express()
const port = process.env.PORT || 3000

const refreshTokenStore = {};
const accessTokenCache = new NodeCache({ deleteOnExpire: true });
if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
    throw new Error('Missing CLIENT_ID or CLIENT_SECRET environment variable.')
}

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const API_KEY = process.env.API_KEY;
let SCOPES = ['contacts'];
if (process.env.SCOPE) {
    SCOPES = (process.env.SCOPE.split(/ |, ?|%20/)).join(' ');
}

const REDIRECT_URI = process.env.REDIRECT_URI;

// Step 1
// Build the authorization URL to redirect a user
// to when they choose to install the app
const authUrl =
  'https://app.hubspot.com/oauth/authorize' +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` + // app's client ID
  `&scope=${encodeURIComponent(SCOPES)}` + // scopes being requested by the app
//   `&optional_scope=${encodeURIComponent(OPTIONAL_SCOPES)}` + // optional scopes being requested by the app
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`; // where to send the user after the consent page

// Redirect the user from the installation page to
// the authorization URL
app.get('/install', (req, res) => {
  console.log('');
  console.log('=== Initiating OAuth 2.0 flow with HubSpot ===');
  console.log('');
  console.log("===> Step 1: Redirecting user to your app's OAuth URL");
  res.redirect(authUrl);
  console.log('===> Step 2: User is being prompted for consent by HubSpot');
});

// Step 3
// Receive the authorization code from the OAuth 2.0 Server,
// and process it based on the query parameters that are passed
app.get('/oauth-callback', async (req, res) => {
  console.log('===> Step 3: Handling the request sent by the server');

  // Received a user authorization code, so now combine that with the other
  // required values and exchange both for an access token and a refresh token
  if (req.query.code) {
    console.log('       > Received an authorization token');

    const authCodeProof = {
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code: req.query.code
    };

    // Step 4
    // Exchange the authorization code for an access token and refresh token
    console.log('===> Step 4: Exchanging authorization code for an access token and refresh token');
    const token = await exchangeForTokens(req.sessionID, authCodeProof);
    if (token.message) {
      return res.redirect(`/error?msg=${token.message}`);
    }

    // Once the tokens have been retrieved, use them to make a query
    // to the HubSpot API
    res.redirect(`/`);
  }
});

//==========================================//
//   Exchanging Proof for an Access Token   //
//==========================================//

const exchangeForTokens = async (userId, exchangeProof) => {
  try {
    const responseBody = await request.post('https://api.hubapi.com/oauth/v1/token', {
      form: exchangeProof
    });
    // Usually, this token data should be persisted in a database and associated with
    // a user identity.
    const tokens = JSON.parse(responseBody);
    refreshTokenStore[userId] = tokens.refresh_token;
    accessTokenCache.set(userId, tokens.access_token, Math.round(tokens.expires_in * 0.75));

    console.log('       > Received an access token and refresh token');
    return tokens.access_token;
  } catch (e) {
    console.error(`       > Error exchanging ${exchangeProof.grant_type} for access token`);
    return JSON.parse(e.response.body);
  }
};

const refreshAccessToken = async (userId) => {
  const refreshTokenProof = {
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    refresh_token: refreshTokenStore[userId]
  };
  return await exchangeForTokens(userId, refreshTokenProof);
};

const getAccessToken = async (userId) => {
  // If the access token has expired, retrieve
  // a new one using the refresh token
  if (!accessTokenCache.get(userId)) {
    console.log('Refreshing expired access token');
    await refreshAccessToken(userId);
  }
  return accessTokenCache.get(userId);
};

const isAuthorized = (userId) => {
  return refreshTokenStore[userId] ? true : false;
};

//====================================================//
//   Using an Access Token to Query the HubSpot API   //
//====================================================//

const getContact = async (accessToken) => {
  console.log('');
  console.log('=== Retrieving a contact from HubSpot using the access token ===');
  try {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
    console.log('===> Replace the following request.get() to test other API calls');
    console.log('===> request.get(\'https://api.hubapi.com/contacts/v1/lists/all/contacts/all?count=1\')');
    const result = await request.get('https://api.hubapi.com/contacts/v1/lists/all/contacts/all?count=1', {
      headers: headers
    });

    return JSON.parse(result).contacts[0];
  } catch (e) {
    console.error('  > Unable to retrieve contact');
    return JSON.parse(e.response.body);
  }
};

//================================================//
//   Querying For Events using the HubSpot API    //
//================================================//

const getEvents = async (accessToken) => {
  console.log('');
  console.log('=== Retrieving a event from HubSpot using the access token ===');
  try {
      
   

var options = {
  method: 'GET',
//   url: 'https://api.hubapi.com/crm/v3/objects/p8731805_my_events',
  url: 'https://api.hubapi.com/crm/v3/objects/p8731805_my_event_tests',
  qs: {
    limit: '10',
    properties: 'event_name',
    paginateAssociations: 'false',
    archived: 'false',
    hapikey: API_KEY
  },
  headers: {accept: 'application/json'}
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});


  } catch (e) {
    console.error('  > Unable to retrieve events');
    return JSON.parse(e.response.body);
  }
};

const getContactAssociations = async (contactId,eventsAttended) => {
  console.log('');
  console.log('=== Retrieving a contact associations from HubSpot using the id ===');
  try {
      
   

var options = {
  method: 'GET',
  url: `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}/associations/p8731805_my_events`,
  qs: {
    paginateAssociations: 'false',
    limit: '500',
    hapikey: API_KEY
  },
  headers: {accept: 'application/json'}
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);
  var data = JSON.parse(body);
  var results = data.results;
  var associatedEvents = [];
  results.forEach((item, index) => {
  associatedEvents.push(item.id);
    });
  console.log(results);
  console.log(associatedEvents);
  var newEventsAttended = eventsAttended.filter(value => associatedEvents.includes(value) == false)
  console.log(`newEventsAttended ${newEventsAttended}`);
  
  if (Array.isArray(newEventsAttended) && newEventsAttended.length){
      //STEP 3 CREATE CONTACTS ASSOCIATION
      
newEventsAttended.forEach((item, index) => {
  console.log('associated new events with contact');
  var options = {
  method: 'PUT',
  url: `https://api.hubapi.com/crm/v3/objects/contact/${contactId}/associations/p8731805_my_events/${item}/event_to_contact`,
  qs: {paginateAssociations: 'false', hapikey: API_KEY},
  headers: {accept: 'application/json'}
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);
  console.log(body);
});
console.log(item);
    });
  }
});


  } catch (e) {
    console.error('  > Unable to retrieve events');
    return JSON.parse(e.response.body);
  }
};

const createObject = async (accessToken) => {
  console.log('');
  console.log('=== creating a custom object in Hubspot using the access token ===');
  try {
//     const headers = {
//       // Authorization: `Bearer ${accessToken}`,
//       'Content-Type': 'application/json',
//       Accept: 'application/json'
//     };
    var options = {
  method: 'POST',
  url: 'https://api.hubapi.com/crm-object-schemas/v3/schemas',
  qs: {hapikey: API_KEY},
  headers: {accept: 'application/json', 'content-type': 'application/json'},
  body: {
    labels: {singular: 'Event', plural: 'Events'},
    requiredProperties: ['event_name'],
    searchableProperties: ['event_name'],
    name: 'my_events',
    primaryDisplayProperty: 'event_name',
    properties: [
      {
        name: 'event_name',
        label: 'Name',
        isPrimaryDisplayLabel: true,
        hasUniqueValue: true
      }
    ],
    associatedObjects: ['CONTACT'],
    metaType: 'PORTAL_SPECIFIC'
  },
  json: true
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
}); 
  } catch (e) {
    console.error('  > Unable to create custom object');
    return JSON.parse(e.response.body);
  }
};

const appendEventAttendProperty = async (accessToken) => {
  console.log('');
  console.log('=== appending event name in contact events_attended property ===');
  try {
    const headers = {
      // Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };
    
var options = {
  method: 'GET',
  url: 'https://api.hubapi.com/crm/v3/properties/contacts/events_attended',
  qs: {archived: 'false', hapikey: API_KEY},
  headers: {accept: 'application/json'}
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);
  
  var obj = JSON.parse(body);
  console.log(obj['options']);
  var dropDownOptions = obj['options'];
  var dropoptions = [];
  dropDownOptions.forEach((item, index)=>{
      dropoptions.push({
          label: item['label'], value: item['value'], displayOrder: -1, hidden: false
      });
  });
  
  console.log(dropoptions);
  dropoptions.push({
          label: 'New Event', value: 'New Event', displayOrder: -1, hidden: false
      });
  
  
  console.log(dropoptions);
  
  var options = {
  method: 'PATCH',
  url: 'https://api.hubapi.com/crm/v3/properties/contacts/events_attended',
  qs: {hapikey: API_KEY},
  headers: {accept: 'application/json', 'content-type': 'application/json'},
  body: {
    options: dropoptions,
    formField: true
  },
  json: true
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
  
});

    
  } catch (e) {
    console.error('  > Unable to create custom object');
    return JSON.parse(e.response.body);
  }
};

//========================================//
//   Displaying information to the user   //
//========================================//

const displayContactName = (res, contact) => {
  if (contact.status === 'error') {
    res.write(`<p>Unable to retrieve contact! Error Message: ${contact.message}</p>`);
    return;
  }
  const { firstname, lastname } = contact.properties;
  res.write(`<p>Contact name: ${firstname.value} ${lastname.value}</p>`);
};

app.get('/', async (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.write(`<h2>HubSpot OAuth 2.0 Quickstart App</h2>`);
  if (isAuthorized(req.sessionID)) {
    const accessToken = await getAccessToken(req.sessionID);
    const contact = await getContact(accessToken);
    res.write(`<h4>Access token: ${accessToken}</h4>`);
    displayContactName(res, contact);
  } else {
    res.write(`<a href="/install"><h3>Install the app</h3></a>`);
  }
  res.end();
});

app.get('/events', async (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.write(`<h2>HubSpot OAuth 2.0 Quickstart App</h2>`);
  if (isAuthorized(req.sessionID)) {
    const accessToken = await getAccessToken(req.sessionID);
    const objectResponse = await getEvents(accessToken);
    res.write(`<pre>objectResponse : ${objectResponse}</pre>`)
  } else {
    res.write(`<a href="/install"><h3>Install the app</h3></a>`);
  }
  res.end();
});


app.get('/customObject', async (req, res) => {
  //TODO : Create UI for object Creation
  res.setHeader('Content-Type', 'text/html');
  res.write(`<h2>HubSpot OAuth 2.0 Quickstart App</h2>`);
  if (isAuthorized(req.sessionID)) {
    const accessToken = await getAccessToken(req.sessionID);
    const objectResponse = await createObject(accessToken);
    res.write(`<pre>objectResponse : ${objectResponse}</pre>`)
  } else {
    res.write(`<a href="/install"><h3>Install the app</h3></a>`);
  }
  res.end();
});

app.get('/contact/append', async (req, res) => {
  //TODO : Create UI for object Creation
  res.setHeader('Content-Type', 'text/html');
  res.write(`<h2>HubSpot OAuth 2.0 Quickstart App</h2>`);
  if (isAuthorized(req.sessionID)) {
    const accessToken = await getAccessToken(req.sessionID);
    const objectResponse = await appendEventAttendProperty(accessToken);
    res.write(`<pre>objectResponse : ${objectResponse}</pre>`)
  } else {
    res.write(`<a href="/install"><h3>Install the app</h3></a>`);
  }
  res.end();
});

app.post('/webhook-callback', async (req, res) => {
  console.log('===>Handling the webhook request sent by the server<===');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Accept', 'application/json');
  //SETP 1 Split recieved data into the required types
  console.log(req.body);
  var data = req.body;
  var sub = data[0];
  var objectId = sub.objectId;
  var eventsAttended = sub.propertyValue.split(';');
  //STEP 2 Get associted events with contact;
  var associations = await getContactAssociations(objectId,eventsAttended);
  res.end();
});

app.get('/error', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.write(`<h4>Error: ${req.query.msg}</h4>`);
  res.end();
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
