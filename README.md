# beaker-analytics-server

The service Beaker uses to track usage. Opt-in only!

```
git clone https://github.com/beaker/beaker-analytics-server.git
cd beaker-analytics-server
npm i
npm start
```

Setup a `~/.bas.yml` with the following fields:

```yml
directory: ~/.bas # where data is stored
domain: analytics.beakerbrowser.com # or wherever
letsencrypt: # set this to false to disable letsencryp
  email: foo@bar.com # set this to get lets-encrypt emails (must be right)
ports:
  http: 80
  https: 443
admins: # can specify more than one
  - username: admin
    password: admin
```

You can change the `admins` fields while BAS is running and the change will be detected and loaded.

Only admins are allowed to access the reports (at `/`).

A weekly report will be computed at 11:30pm every saturday.