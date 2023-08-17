/*
 MIT License

Copyright (c) 2019, 2021 - IBM Corp.

 Permission is hereby granted, free of charge, to any person obtaining a copy of this software
 and associated documentation files (the "Software"), to deal in the Software without restriction,
 including without limitation the rights to use, copy, modify, merge, publish, distribute,
 sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:
 The above copyright notice and this permission notice shall be included in all copies or substantial
 portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
 NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
// import necessary library
const express = require("express");
const axios = require("axios");
const rls = require("readline-sync");
const app = express();
// set urlencoded
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
// loading .env as envirmental file
require("dotenv").config();

// import user data from env
const config = {
  tenantUrl: process.env.TENANT_URL,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  flowType: process.env.FLOW_TYPE,
  scope: process.env.SCOPE,
};

// welcome information
console.log("Openid-connect ROPC sample application\n\n");
console.log("Authenticate against");
console.log(`tenant    : ${config.tenantUrl}`);
console.log(`client ID : ${config.clientId}\n\n`);

// gather user password and username
const username = rls.question("username: ");
const password = rls.question("password: ", { hideEchoBack: true });

// POST method for post necessary date to server and get Token
const optionsGetToken = {
  method: "POST",
  url: "https://student-devportal.rel.verify.ibmcloudsecurity.com/v1.0/endpoint/default/token",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  data: new URLSearchParams({
    grant_type: "password",
    username: username,
    password: password,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  }),
};

//send request to server for getting token
axios
  .request(optionsGetToken)
  .then(function (token) {
    console.log(`=================================Tokens are`,token.data);
    // POST method for post necessary date to server and get User jwt
    const optionsGetUserInfo = {
      method: "POST",
      url: "https://student-devportal.rel.verify.ibmcloudsecurity.com/v1.0/endpoint/default/userinfo",
      headers: { "content-type": "application/x-www-form-urlencoded","accept":"application/json" },
      data: new URLSearchParams({
        access_token: token.data.access_token,
        token_type: token.data.token_type,
        refresh_token: token.data.refresh_token,
        expires_in: token.data.expires_in,
        id_token: token.data.id_token,
      }),
    };
    //send request to server for receive User Info
    axios
    .request(optionsGetUserInfo)
    .then(function (userInfo) {
      console.log(`=================================UserInfos are`, userInfo.data);
    }).catch(function (error) {
    console.error(error);
  });
  })
  .catch(function (error) {
    console.error(error);
  });


 
// listening server
app.listen(process.env.PORT, () => {
  console.log(`App listening on port ${process.env.PORT}`);
});
