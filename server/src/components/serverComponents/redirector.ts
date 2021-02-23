
import arp from "app-root-path";
const _dirname = arp.path;


import { Request, Response } from "express";
import dotenv from "dotenv";
import { join } from "path";

const envres = dotenv.config({ path: join(_dirname, ".env") })

if (envres.error) {
  throw envres.error
}

const env = envres.parsed;


export function redirector(app: any) {

  // google recaptcha
  app.get('/captcha', (_: Request, res: Response) =>
    res.redirect(
      `https://www.google.com/recaptcha/api.js?render=${env ? env.SITEKEY : ""}`
    ))// handeling google recapcha with .env file




  // bootstrap css
  app.get('/bootstrap.css', (_: Request, res: Response) =>
    res.redirect(
      `https://cdn.jsdelivr.net/npm/bootstrap@5.0.0-beta1/dist/css/bootstrap.min.css`
    ))

  // bootstrap js
  app.get('/bootstrap.js', (_: Request, res: Response) =>
    res.redirect(
      `https://cdn.jsdelivr.net/npm/bootstrap@5.0.0-beta1/dist/js/bootstrap.bundle.min.js`
    ))

}

