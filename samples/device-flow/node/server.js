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
//import necessry function
const express = require("express");
const { Issuer } = require("openid-client");
const storage = require('node-persist')
const session = require("express-session");
const app = express();
const path = require("path");
const { env } = require("process");
// init session
app.use(
  session({
    secret: "my-secret",
    resave: true,
    saveUninitialized: true,
  })
);
// reading env
require("dotenv").config({ path: "./.env" });


// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// storage.init();
storage.init();
// setting port address
const port = process.env.PORT;
const http = require("http").Server(app);
// init io
const io = require("socket.io")(http);
// function for setUp OIDC
async function setupOIDC() {
  const issuer = await Issuer.discover(
    "https://student-devportal.rel.verify.ibmcloudsecurity.com/v1.0/endpoint/default/.well-known/openid-configuration"
  );
  const client = new issuer.Client({
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
  });

  return client;
}

// function for get verity Token
const verifyToken = async (req, res, next) => {
  const token = await storage.getItem("tokenSet");
  if (token) {
    req.session.token = token;
    next();
  } else {
    res.redirect("/");
  }
};

// setting front page
app.get("/", (req, res) => {
  res.render("index");
});

// initialize the OIDC client
setupOIDC()
  .then((client) => {
    // authorization endpoint
    app.get("/authorize", async (req, res) => {
      const params = {
        client_id: process.env.CLIENT_ID,
        scope: process.env.SCOPE,
        response_type: "device_code",
      };

      const deviceCodeResponse = await client.deviceAuthorization(params);

      // set session variables
      req.session.deviceCode = deviceCodeResponse.device_code;
      req.session.userCode = deviceCodeResponse.user_code;
      console.log("========= req.session.deviceCode", req.session);

      // io.emit("authInfo", {
      //   deviceCode: deviceCodeResponse.device_code,
      //   userCode: deviceCodeResponse.user_code,
      // });
      //send url to client
      res.render("authorize", {
        userCode: deviceCodeResponse.user_code,
        verificationUri: deviceCodeResponse.verification_uri,
        qrCode: deviceCodeResponse.verification_uri_complete,
      });
      // start polling for authentication status
      pollAuthenticationStatus(deviceCodeResponse, client);
    });

    // authenticated page
    app.get("/authenticated", verifyToken, async (req, res) => {
      console.log("======== Requesting userInfo claims using valid token");
      const token = await storage.getItem("tokenSet");
      console.log("======== token", token);
      const userinfo = await client
        .userinfo(token.access_token)
        .catch((err) => {
          console.log(err);
        });
      res.render("authenticated", {
        message: "successfully authenticated",
        userInfo: userinfo,
      });
      console.log("======== userinfo", userinfo);
    });

    // logout
    app.get("/logout", async (req, res) => {
      // destroy session
      req.session.destroy(() => {
        res.redirect("/");
      });
      const token = await storage.getItem("tokenSet");
      // revoke token from storage
      await storage.removeItem("tokenSet").catch(console.error);
      // revoke token from OP
      const result = await client.revoke(token.access_token);
      // check result
      console.log(result);
    });
  })
  .catch(console.error);

// start server
http.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
// socket.io
io.on("connection", function (socket) {
  console.log("node client connected");
  socket.on("disconnect", function () {
    console.log("client disconnected");
  });
});
// function to poll for authentication status
async function pollAuthenticationStatus(req, client) {
  //set params for token request
  const params = {
    client_id: client.client_id,
    client_secret: client.client_secret,
    device_code: req.device_code,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  };
  //set authCompleted to false
  let authCompleted = false;
  //loop until authCompleted is true
  while (!authCompleted) {
    try {
      //check if tokenSet is valid
      const tokenSet = await client.grant(params);
      // save tokenSet to storage
      await storage.setItem("tokenSet", tokenSet).catch(console.error);
      console.log("========= userinfo", tokenSet);
      // if tokenSet is valid, end the loop
      authCompleted = true;
      // emit success event to client and redirect to authenticated page
      await io.emit("success", { auth: "/authenticated" });
    } catch (err) {
      // check if error is OPError
      if (err.name === "OPError") {
        // set auto polling interval
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        // if error is not OPError, end the loop
        console.log(err);
        break;
      }
    }
  }
}
