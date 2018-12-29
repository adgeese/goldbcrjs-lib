import { Payment, PaymentOpts } from './index'
import * as bscript from '../script'
import * as lazy from './lazy'
import { bitcoin as BITCOIN_NETWORK } from '../networks'
const typef = require('typeforce')
import { OPS } from '../script'
const ecc = require('tiny-secp256k1')

// input: {signature}
// output: {pubKey} OP_CHECKSIG
export function p2pk (a: Payment, opts?: PaymentOpts): Payment {
  if (
    !a.input &&
    !a.output &&
    !a.pubkey &&
    !a.input &&
    !a.signature
  ) throw new TypeError('Not enough data')
  opts = Object.assign({ validate: true }, opts || {})

  typef({
    network: typef.maybe(typef.Object),
    output: typef.maybe(typef.Buffer),
    pubkey: typef.maybe(ecc.isPoint),

    signature: typef.maybe(bscript.isCanonicalScriptSignature),
    input: typef.maybe(typef.Buffer)
  }, a)

  const _chunks = <()=>Array<Buffer | number>>lazy.value(function () { return bscript.decompile(<Buffer>a.input) })

  const network = a.network || BITCOIN_NETWORK
  const o: Payment = { network }

  lazy.prop(o, 'output', function () {
    if (!a.pubkey) return
    return bscript.compile([
      a.pubkey,
      OPS.OP_CHECKSIG
    ])
  })
  lazy.prop(o, 'pubkey', function () {
    if (!a.output) return
    return a.output.slice(1, -1)
  })
  lazy.prop(o, 'signature', function () {
    if (!a.input) return
    return <Buffer>_chunks()[0]
  })
  lazy.prop(o, 'input', function () {
    if (!a.signature) return
    return bscript.compile([a.signature])
  })
  lazy.prop(o, 'witness', function () {
    if (!o.input) return
    return []
  })

  // extended validation
  if (opts.validate) {
    if (a.output) {
      if (a.output[a.output.length - 1] !== OPS.OP_CHECKSIG) throw new TypeError('Output is invalid')
      if (!ecc.isPoint(o.pubkey)) throw new TypeError('Output pubkey is invalid')
      if (a.pubkey && !a.pubkey.equals(<Buffer>o.pubkey)) throw new TypeError('Pubkey mismatch')
    }

    if (a.signature) {
      if (a.input && !a.input.equals(<Buffer>o.input)) throw new TypeError('Signature mismatch')
    }

    if (a.input) {
      if (_chunks().length !== 1) throw new TypeError('Input is invalid')
      if (!bscript.isCanonicalScriptSignature(<Buffer>o.signature)) throw new TypeError('Input has invalid signature')
    }
  }

  return Object.assign(o, a)
}