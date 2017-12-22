import * as express from 'express'
import * as bodyParser from 'body-parser'
import * as path from 'path'
import * as nodemailer from 'nodemailer'
import * as nodeCrypto from 'crypto'
import * as Pusher from 'pusher-js'

interface Threshold {
  readonly orientation: 'up' | 'down'
  readonly amount: number
}
interface Subscriber {
  readonly secret: string
  readonly thresholds: ReadonlyArray<Threshold>
}

function thresholdsEqual(a: Threshold, b: Threshold): boolean {
  if(a.orientation !== b.orientation) {
    return false
  }
  if(a.amount !== b.amount) {
    return false
  }
  return true
}

let candidates: { readonly [key: string]: string } = {}
let subscribers: { readonly [key: string]: Subscriber } = {}

const baseUrl: string = process.env.BASE_URL

const app = express()
const mail = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
})
const bitstamprAppKey = 'de504dc5763aeef9ff52'
const pusher = new Pusher(bitstamprAppKey)
const liveTradesChannel: Pusher.Channel = pusher.subscribe('live_trades_btceur')

let price: number
liveTradesChannel.bind('trade', trade => {
  // console.log('TRADE', trade)
  const oldPrice: number = price
  const newPrice: number = trade.price
  price = newPrice // update the price
  const up: boolean = newPrice >= oldPrice
  const down: boolean = newPrice <= oldPrice
  const thresholds = Object
    .keys(subscribers)
    .map(key => subscribers[key].thresholds.map(threshold => ({
      subscriber: key,
      threshold
    })))
    .reduce((accu, subscriber) => [...accu, ...subscriber], [])
  const matchingUpThresholds = up? thresholds
    .filter(threshold => {
      if(threshold.threshold.orientation === 'up') {
        if(threshold.threshold.amount >= oldPrice) {
          if(threshold.threshold.amount <= newPrice) {
            return true
          }
        }
      }
      return false
    }) : []
  const matchingDownThresholds = down? thresholds
    .filter(threshold => {
      if(threshold.threshold.orientation === 'down') {
        if(threshold.threshold.amount <= oldPrice) {
          if(threshold.threshold.amount >= newPrice) {
            return true
          }
        }
      }
      return false
    }) : []
  // console.log('THRESHOLDS', thresholds)
  if(matchingUpThresholds.length > 0) {
    console.log('MATCHING UP', matchingUpThresholds)
  }
  if(matchingDownThresholds.length > 0) {
    console.log('MATCHING DOWN', matchingDownThresholds)
  }
  matchingUpThresholds.forEach(async threshold => {
    await mail.sendMail({
      to: threshold.subscriber,
      subject: 'Bit Alert: Up Threshold crossed',
      text: `Up Threshold: ${threshold.threshold.amount} EUR
Price before: ${oldPrice} EUR
Price after: ${newPrice} EUR`
    })
  })
  matchingDownThresholds.forEach(async threshold => {
    await mail.sendMail({
      to: threshold.subscriber,
      subject: 'Bit Alert: Down Threshold crossed',
      text: `Down Threshold: ${threshold.threshold.amount} EUR
Price before: ${oldPrice} EUR
Price after: ${newPrice} EUR`
    })
  })
})

app.use(express.static('dist'))
app.use(bodyParser.json())

async function generateSecret(): Promise<string> {
  const buffer: Buffer = await new Promise<Buffer>((resolve, reject) => {
    const numberOfBytes: number = 10
    nodeCrypto.randomBytes(numberOfBytes, (err, result) => err? reject(err) : resolve(result))
  })
  return buffer.toString('hex')
}

app.get('/api/register/:emailAddress', async (req, res) => {
  const emailAddress = req.params.emailAddress
  const activationCode = await generateSecret()
  // update candidates
  candidates = { ...candidates, [activationCode]: emailAddress }
  await mail.sendMail({
    to: emailAddress,
    subject: 'Activate your Bit Alert',
    text: `${baseUrl}/activate/${activationCode}`
  })
  res.status(200).end()
})

app.get('/activate/:activationCode', async (req, res) => {
  const activationCode: string = req.params.activationCode
  const emailAddress: string = candidates[activationCode]
  if(!emailAddress) {
    res.status(404).end()
    return
  }
  // add the email address to the subscriber list
  const existingSubscriber = subscribers[emailAddress]
  const secret: string = await generateSecret()
  subscribers = { ...subscribers, [emailAddress]: existingSubscriber || { secret, thresholds: [] } }
  console.log('CANDIDATES BEFORE', candidates)
  candidates = Object.keys(candidates).reduce((accu, key) => key === activationCode? accu : { ...accu, [key]: candidates[key] }, {})
  console.log('CANDIDATES AFTER', candidates)
  console.log('SUBSCRIBERS', subscribers)
  res.redirect(`/user/${secret}`)
})

function requestToSubscriberAndThreshold(req: express.Request, res: express.Response): {
  readonly emailAddress?: string
  readonly subscriber?: Subscriber
  readonly threshold?: Threshold
  readonly error?: boolean
} {
  const emailAddress: string = req.params.emailAddress
  const secret = req.params.secret
  const orientation: string = req.params.orientation
  const amountString: string = req.params.amount
  if(isNaN(<any>amountString)) {
    res.status(400).end()
    return {}
  }
  if(orientation !== 'up') {
    if(orientation !== 'down') {
      res.status(400).end()
      return {}
    }
  }
  const threshold: Threshold = { orientation, amount: +amountString }
  const subscriber: Subscriber = subscribers[emailAddress]
  if(subscriber) {
    if(secret !== subscriber.secret) {
      res.status(401).end()
      return {}
    }
  }
  return { emailAddress, subscriber, threshold }
}

app.get('/api/users/:emailAddress/:secret/thresholds/add/:orientation/:amount', (req, res) => {
  const { emailAddress, subscriber, threshold } = requestToSubscriberAndThreshold(req, res)
  if(!subscriber) {
    res.status(404).end()
    return
  }
  const thresholds = subscriber.thresholds
  const updatedSubscriber: Subscriber = { ...subscriber, thresholds: [...thresholds.filter(_ => !thresholdsEqual(_, threshold)), threshold] }
  subscribers = { ...subscribers, [emailAddress]: updatedSubscriber }
  res.status(200).end()
})
app.get('/api/users/:emailAddress/:secret/thresholds/remove/:orientation/:amount', (req, res) => {
  const { emailAddress, subscriber, threshold } = requestToSubscriberAndThreshold(req, res)
  if(!subscriber) {
    res.status(404).end()
    return
  }
  const thresholds = subscriber.thresholds
  const updatedSubscriber: Subscriber = { ...subscriber, thresholds: thresholds.filter(_ => !thresholdsEqual(_, threshold)) }
  subscribers = { ...subscribers, [emailAddress]: updatedSubscriber }
  res.status(200).end()
})
app.post('/api/users/:emailAddress/:secret/thresholds', (req, res) => {
  const emailAddress: string = req.params.emailAddress
  const secret: string = req.params.secret
  const subscriber: Subscriber = subscribers[emailAddress]
  if(!subscriber) {
    res.status(404).end()
    return
  }
  if(secret !== subscriber.secret) {
    res.status(401).end()
    return
  }
  subscribers = { ...subscribers, [emailAddress]: { ...subscriber, thresholds: req.body } }
  res.status(200).end()
})
app.get('/api/users/:emailAddress/:secret/thresholds', (req, res) => {
  const emailAddress: string = req.params.emailAddress
  const secret: string = req.params.secret
  const subscriber: Subscriber = subscribers[emailAddress]
  if(!subscriber) {
    res.status(404).end()
    return
  }
  if(secret !== subscriber.secret) {
    res.status(401).end()
    return
  }
  res.json(subscriber.thresholds).end()
})

// everything else --> index.html
app.get('/*', (req, res) => {
   res.sendFile(path.join(__dirname, '../dist/index.html'))
})

const host: string = process.env.HOST
const port: number = +process.env.PORT || 8080
app.listen(port, host, () => {
  console.log('Bitstampr listening on ' + (host||'') + ':' + port)
})
