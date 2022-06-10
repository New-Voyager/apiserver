'use strict';

import { errToStr, getLogger } from '@src/utils/log';

const nodemailer = require('nodemailer');
const account = 'contact.poker.clubapp@gmail.com';
const password = 'qtskemecvlgoryqn';
const logger = getLogger('email');
export async function sendRecoveryCode(
  to: string,
  from: string | undefined | null,
  code: string
) {
  if (!from) {
    from = 'contact.poker.clubapp@gmail.com';
  }
  const body = `Recovery code to recover/transfer your pokerclub account: ${code}`;
  sendEmail(to, from, 'Recovery code', body).catch(err => {
    logger.error(`Sending recovery code email failed. Error: ${errToStr(err)}`);
  });
}

// async..await is not allowed in global scope, must use a wrapper
export async function sendEmail(
  to: string,
  from: string,
  subject: string,
  body: string,
  bodyHtml?: string
) {
  var nodemailer = require('nodemailer');
  var smtpTransport = require('nodemailer-smtp-transport');

  var transporter = nodemailer.createTransport(
    smtpTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      auth: {
        user: account,
        pass: password,
      },
    })
  );

  var mailOptions: any = {
    from: `"Poker Club App" ${from}`,
    to: to,
    subject: subject,
    text: body,
  };
  if (bodyHtml) {
    mailOptions.html = bodyHtml;
  } else {
    mailOptions.text = body;
  }

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      logger.error(error);
    } else {
      logger.verbose('Email sent: ' + info.response);
    }
  });
}

