import * as express from 'express'
import * as path from 'path'
import * as nodemailer from 'nodemailer'
import * as nodeCrypto from 'crypto'

interface Threshold {
  readonly orientation: 'upper' | 'lower'
  readonly amount: number
}
type Subscriber = ReadonlyArray<Threshold>

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

const app = express()
const mail = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'bit2alert@gmail.com',
    pass: 'jGL9aJWv'
  }
})

app.use(express.static('dist'))

app.get('/register/:emailAddress', async (req, res) => {
  const emailAddress = req.params.emailAddress
  const activationCodeBuffer: Buffer = await new Promise<Buffer>((resolve, reject) => {
    const numberOfBytes: number = 10
    nodeCrypto.randomBytes(numberOfBytes, (err, result) => err? reject(err) : resolve(result))
  })
  const activationCode: string = activationCodeBuffer.toString('hex')
  // update candidates
  candidates = { ...candidates, [activationCode]: emailAddress }
  await mail.sendMail({
    to: 'cndreiter@gmail.com',
    subject: 'Activate your Bit Alert',
    text: `http://localhost:8080/activate/${activationCode}`
  })
  res.status(200).end()
})

app.get('/activate/:activationCode', (req, res) => {
  const activationCode: string = req.params.activationCode
  const emailAddress: string = candidates[activationCode]
  if(!emailAddress) {
    res.status(404).end()
    return
  }
  // add the email address to the subscriber list
  const existingSubscriber = subscribers[emailAddress]
  subscribers = { ...subscribers, [emailAddress]: existingSubscriber || [] }
  console.log('CANDIDATES BEFORE', candidates)
  candidates = Object.keys(candidates).reduce((accu, key) => key === activationCode? accu : { ...accu, [key]: candidates[key] }, {})
  console.log('CANDIDATES AFTER', candidates)
  console.log('SUBSCRIBERS', subscribers)
  res.status(200).end()
})

function requestToSubscriberAndThreshold(req: express.Request, res: express.Response): {
  readonly emailAddress?: string
  readonly subscriber?: Subscriber
  readonly threshold?: Threshold
  readonly error?: boolean
} {
  const emailAddress: string = req.params.emailAddress
  const orientation: string = req.params.orientation
  const amountString: string = req.params.amount
  if(isNaN(<any>amountString)) {
    res.status(400).end()
    return {}
  }
  if(orientation !== 'upper') {
    if(orientation !== 'lower') {
      res.status(400).end()
      return {}
    }
  }
  const threshold: Threshold = { orientation, amount: +amountString }
  const subscriber: Subscriber = subscribers[emailAddress]
  return { emailAddress, subscriber, threshold }
}

app.get('/users/:emailAddress/thresholds/add/:orientation/:amount', (req, res) => {
  const { emailAddress, subscriber, threshold } = requestToSubscriberAndThreshold(req, res)
  if(!subscriber) {
    res.status(404).end()
    return
  }
  const updatedSubscriber: Subscriber = [...subscriber.filter(_ => !thresholdsEqual(_, threshold)), threshold]
  subscribers = { ...subscribers, [emailAddress]: updatedSubscriber }
  res.status(200).end()
})
app.get('/users/:emailAddress/thresholds/remove/:orientation/:amount', (req, res) => {
  const { emailAddress, subscriber, threshold } = requestToSubscriberAndThreshold(req, res)
  if(!subscriber) {
    res.status(404).end()
    return
  }
  const updatedSubscriber: Subscriber = subscriber.filter(_ => !thresholdsEqual(_, threshold))
  subscribers = { ...subscribers, [emailAddress]: updatedSubscriber }
  res.status(200).end()
})
app.get('/users/:emailAddress/thresholds', (req, res) => {
  const emailAddress: string = req.params.emailAddress
  const subscriber: Subscriber = subscribers[emailAddress]
  if(!subscriber) {
    res.status(404).end()
    return
  }
  res.json(subscriber).end()
})

// everything else --> index.html
app.get('/*', (req, res) => {
   res.sendFile(path.join(__dirname, 'dist/index.html'))
})

const host: string = process.env.HOST
const port: number = +process.env.PORT || 8080
app.listen(port, host, () => {
  console.log('Bitstampr listening on ' + (host||'') + ':' + port)
})
