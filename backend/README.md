<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Template week schedule

Templates can be assigned to multiple weekdays in one request through
`daysOfWeek` (`0` = Monday, ..., `6` = Sunday). The same template is reused on
each selected day; schedule changes are made on the template itself. The API
continues to return the legacy single-day `dayOfWeek` field for older clients,
and new clients should use `daysOfWeek`. The old weekly-plan endpoints are no
longer registered.

The migration adds `Template.daysOfWeek` and preserves existing schedules by
copying valid `Template.dayOfWeek` and `weekly_plan_days.dayOfWeek` values into
the new array. Legacy weekly-plan tables remain in the database; the migration
does not delete them.

Template creation/update remains compatible with `exerciseIds`. New clients
can send `exercises: [{ exerciseId, sets?, reps?, weight?, durationSeconds?,
restSeconds?, distance? }]` instead (the two formats cannot be combined).

## Workout history API

All workout routes require the authenticated `token` cookie. User IDs and JWT
subjects are UUID strings. `GET /workouts/current` returns the user's active
workout or `null` and is the resume/recovery endpoint. `POST /workouts/start`
starts a blank workout or snapshots a template's exercise names, ordering, and
prescription settings into a new session:

```json
{ "templateId": "template-id", "name": "Upper body" }
```

A user has at most one active session; repeated start calls return that active
session.

- `POST /workouts/:sessionId/exercises` adds `{ "exerciseId": 12 }` or a custom
  `{ "name": "Custom movement" }` entry. `PATCH` and `DELETE`
  `/workouts/:sessionId/exercises/:entryId` edit or remove it.
- `POST /workouts/:sessionId/exercises/:entryId/series` creates a series;
  `PATCH` and `DELETE /workouts/:sessionId/series/:seriesId` update or remove
  one. Series fields are `reps`, `weight`, `durationSeconds`, `distance`,
  `restSeconds`, `rpe`, `rir`, `notes`, `isDone`, and `order`. Numeric
  measurements are stored as PostgreSQL `DECIMAL(10,2)` for weight/distance
  and `DECIMAL(3,1)` for RPE, and serialized as fixed-scale strings.
- `PATCH /workouts/:sessionId/autosave` accepts optional session `name` and
  nested `exercises`; IDs update existing entries, missing IDs create entries.
  Omitted entries are retained; use the explicit delete routes to remove them.
- `POST /workouts/:sessionId/finish` completes a workout idempotently;
  `POST /workouts/:sessionId/cancel` cancels it. `GET /workouts/history`
  returns the latest completed/cancelled sessions (`limit` 1–100, default 50),
  `GET /workouts/:sessionId` returns a session detail, and
  `GET /workouts/exercises/:exerciseId/previous` returns the latest completed
  performance for that accessible exercise.

Session responses contain `{ id, name, templateId, templateName, status,
startedAt, endedAt, exercises }`; each exercise entry includes its copied
`name`, optional linked `exerciseId`, `order`, and its independently editable
`series`. Each series includes the measurement fields, `isDone`, and `order`.
All workout reads and mutations are scoped to the authenticated user. The UUID
migration maps every existing integer user ID to a generated UUID and converts
all existing user foreign keys through the same mapping, preserving accounts
and ownership relations. Existing cookies with integer JWT subjects will need
to authenticate again after migration.

## Project setup

```bash
$ npm install
```

## RepLoad deployment

The production frontend is hosted at `https://repload.vercel.app` and the API
at `https://repload.onrender.com`. Configure these environment variables on
Render (never commit production secrets):

- `NODE_ENV=production`
- `FRONTEND_URL=https://repload.vercel.app` (comma-separated origins are
  supported when more than one frontend origin is needed)
- `JWT_SECRET` with a long, unique random value
- `DATABASE_URL` with the PostgreSQL connection string

Render supplies `PORT`. The Vercel project should use `frontend` as its root
directory and set `BACKEND_URL=https://repload.onrender.com`. The frontend
proxies API requests through its own origin, allowing the HttpOnly session
cookie to work across desktop and mobile browsers.

Configure the Render service with `backend` as its root directory,
`npm ci && npm run build` as its build command, and `npm run start:prod` as its
start command. The build generates the Prisma client from the checked-in
schema before compiling NestJS; generated Prisma files are intentionally not
stored in Git. The production start command runs `prisma migrate deploy`
before starting NestJS, so committed migrations are applied before the API
serves requests.

For local development, copy `.env.example` to `.env` and set the local
database credentials. The example allows both localhost and the production
frontend origin.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
