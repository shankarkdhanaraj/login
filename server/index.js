const express = require('express');
const bodyParser = require('body-parser');
// const cors = require('cors');
const fetch = require('node-fetch');
// const bufferify = require('json-bufferify');
const request = require('request');
// const requestPromise = require('request-promise-native');
const { getUserId, createJWT } = require('./utils.js');
const db = require('../database/dbUtils.js');
const { logger } = require('./logger.js');

const PORT = process.env.PORT || 50000;
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:9876';
const HOME_PAGE_URL = process.env.HOME_PAGE_URL || 'http://18.217.151.202/homepage';
const app = express();
const jsonParser = bodyParser.json();

// app.use(cors());
app.use('/signin', express.static('public'));
app.use('/signin', express.static('dist'));

app.get('/test', jsonParser, (req, res) => {
  const testString = 'If you see this, test is successful.';
  logger.info({ testString });
  console.log(`testString is ${testString}`);
  res.send(testString);
});

app.post('/createlogin', jsonParser, (req, res) => {
  db.createUser(req.body.password)
    .then((userId) => {
      const jsonStringBody = { username: userId.toString() };
      // const expressGatewayOptions = {
      //   url: `${API_GATEWAY_URL}/users`,
      //   json: true,
      //   method: 'POST',
      //   'User-Agent': 'request',
      //   body: jsonStringBody,
      //   'Content-Type': 'application/json',
      //   'Access-Control-Allow-Origin': true,
      // };
      console.log(jsonStringBody);
      const kongAPIGatewayOptionsCreateConsumer = {
        url: `${API_GATEWAY_URL}/consumers`,
        json: true,
        method: 'POST',
        'User-Agent': 'request',
        body: jsonStringBody,
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': true,
      };


      request(kongAPIGatewayOptionsCreateConsumer, (err, response, body) => {
        if (err) {
          console.log('error in create consumer call', err);
        } else {
          console.log('Response body ....', body);
          console.log('Username is  ....', userId.toString());
          res.json(body);
        }
      });
    },
    error => res.send(error));
});

app.get('/signingin', jsonParser, (req, res) => {
  const {
    email,
    password,
  } = req.query;

  getUserId(email)
    .then((userId) => {
      console.log('userId is ', userId);
      if (userId === 'false') {
        res.send(JSON.stringify({ userId: null })); // NEEDS TO BE CHANGED LATER
      } else {
        // CHECK FOR PASSWORD HERE
        const kongAPIGatewayOptionsCreateCredential = {
          url: `${API_GATEWAY_URL}/consumers/${userId}/jwt`,
          method: 'POST',
          'User-Agent': 'request',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Access-Control-Allow-Origin': true,
        };
        const kongAPIGatewayOptionsDeleteCredential = {
          method: 'DELETE',
          'User-Agent': 'request',
          'Access-Control-Allow-Origin': true,
        };

        // DELETE ANY EXISTING CREDENTIAL
        // curl -X GET http://kong:8001/consumers/{consumer}/jwt
        fetch(`${API_GATEWAY_URL}/consumers/${userId}/jwt`)
          .then(response => response.json())
          .then((credentialList) => {
            if (credentialList.total > 1) {
              console.log('too many credentials');
              res.send({ error: `error: too many credentials for the user, ${userId}` });
              return 1;
            } else if (credentialList.total === 1) {
              const deletUrl = `${API_GATEWAY_URL}/consumers/${userId}/jwt/${credentialList.data[0].id}`;
              console.log(`deleting credential...${deletUrl}`);
              return fetch(deletUrl, kongAPIGatewayOptionsDeleteCredential);
            }
            return 2;
          })
          .then(() => {
            // CREATE THE KONG CREDENTIALS FOR THE USER WITH FETCH
            fetch(`${API_GATEWAY_URL}/consumers/${userId}/jwt`, kongAPIGatewayOptionsCreateCredential)
              .then(response => response.json())
              .then((credential) => {
                console.log('Created Credential is...', credential);
                const {
                  id: credentialId,
                  secret,
                  key,
                } = credential;
                // CRETATE THE JWT WITH THE CREDENTIALS FROM KONG
                const token = createJWT(userId, credentialId, secret, key);
                console.log('created token is...', token);

                // SEND THE JWT BACK
                res.json({ token });
              });
            // // CREATE THE KONG CREDENTIALS FOR THE USER WITH REQUEST - DONE
            // request(kongAPIGatewayOptionsCreateCredential, (err, response, body) => {
            //   if (err) {
            //     console.log('error in create credential call', err);
            //   } else {
            //     console.log('Created Credential is...', body);
            //     const {
            //       id: credentialId,
            //       secret,
            //       key,
            //     } = JSON.parse(body);
            //     // CRETATE THE JWT WITH THE CREDENTIALS FROM KONG
            //     const token = createJWT(userId, credentialId, secret, key);
            //     console.log('created token is...', token);

            //     // SEND THE JWT BACK
            //     res.json({ token });
            //   }
            // });
          });

        // const url = `${HOME_PAGE_URL}?userid=${userId}`;
        // console.log('Redirected url is...', url);
        // // res.status(200).send(`<html><body></body><script type="text/javascript">window.location.href=${url};</script></html>`);
        // // res.status(301);
        // // return res.redirect(url);
        // return res.redirect(301, url);
        // res.send(JSON.stringify({ userId }));
      }
    });
});

app.get('/signedintest', jsonParser, (req, res) => {
  console.log('Request is..', req);
  logger.info({ 'requested user': req.body });
  res.send('you are now signed in');
});

app.get('/signedinhome', jsonParser, (req, res) => {
  console.log('Request is..', req);
  logger.info({ 'requested user': req.body });
  res.send(req.body);
});


app.listen(PORT);
