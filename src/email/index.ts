'use strict';
const nodemailer = require('nodemailer');
const account = 'contact.poker.clubapp@gmail.com';
const password = 'Poker!234';
export async function sendRecoveryCode(
  to: string,
  from: string | undefined | null,
  code: string
) {
  if (!from) {
    from = 'contact.poker.clubapp@gmail.com';
  }
  const body = `Recovery code to recover/transfer your pokerclub account: ${code}`;
  sendEmail(to, from, 'Recovery code', body);
}

// async..await is not allowed in global scope, must use a wrapper
async function sendEmail(
  to: string,
  from: string,
  subject: string,
  body: string
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

  var mailOptions = {
    from: `"Poker Club App" ${from}`,
    to: to,
    subject: subject,
    text: body,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}