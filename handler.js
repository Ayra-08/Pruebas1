import { smsg } from './lib/simple.js'
import { format } from 'util'
import { fileURLToPath } from 'url'
import path, { join } from 'path'
import { unwatchFile, watchFile } from 'fs'
import chalk from 'chalk'
import ws from 'ws'
/**
 * @type {import('@whiskeysockets/baileys')}
 */
const { proto } = (await import('@whiskeysockets/baileys')).default
const isNumber = x => typeof x === 'number' && !isNaN(x)
const delay = ms => isNumber(ms) && new Promise(resolve => setTimeout(function () {
    clearTimeout(this)
    resolve()
}, ms))

/**
 * Handle messages upsert
 * @param {import('@adiwajshing/baileys').BaileysEventMap<unknown>['messages.upsert']} groupsUpdate 
 */
export async function handler(chatUpdate) {
    this.msgqueque = this.msgqueque || []
    if (!chatUpdate)
        return
    this.pushMessage(chatUpdate.messages).catch(console.error)
    let m = chatUpdate.messages[chatUpdate.messages.length - 1]
    if (!m)
        return
    if (global.db.data == null)
        await global.loadDatabase()
    try {
        m = smsg(this, m) || m
        if (!m)
            return
        m.exp = 0
        m.limit = false
    //    m.gold = false
        try {
            // TODO: use loop to insert data instead of this
            let user = global.db.data.users[m.sender]
            if (typeof user !== 'object')
                global.db.data.users[m.sender] = {}
            if (user) {
                if (!isNumber(user.exp))
                    user.exp = 0
                if (!isNumber(user.limit))
                    user.limit = 10
                if (!('premium' in user)) 
                    user.premium = false
                if (!user.premium) 
                    user.premiumTime = 0
                if (!isNumber(user.lastclaim))
                    user.lastclaim = 0
                if (!('registered' in user))
                    user.registered = false
                    //-- user registered 
                if (!user.registered) {
                    if (!('name' in user))
                        user.name = m.name
                    if (!isNumber(user.age))
                        user.age = -1
                    if (!isNumber(user.regTime))
                        user.regTime = -1
                }
                //--user number
                if (!isNumber(user.afk))
                    user.afk = -1
                if (!('afkReason' in user))
                    user.afkReason = ''
                if (!('banned' in user))
                    user.banned = false
                if (!isNumber(user.warn))
                    user.warn = 0
                if (!isNumber(user.level))
                    user.level = 0
                if (!isNumber(user.bank))
                    user.bank = 0
            } else
                global.db.data.users[m.sender] = {
                    exp: 0,
                    limit: 10,
                    lastclaim: 0,
                    registered: false,
                    name: m.name,
                    age: -1,
                    regTime: -1,
                    afk: -1,
                    afkReason: '',
                    banned: false,
                    warn: 0,
                    bank: 0,
                    level: 0,
                }
            let chat = global.db.data.chats[m.chat]
            if (typeof chat !== 'object')
                global.db.data.chats[m.chat] = {}
            if (chat) {
                if (!('isBanned' in chat))
                    chat.isBanned = false
                if (!('welcome' in chat))
                    chat.welcome = false
                if (!('sWelcome' in chat))
                    chat.sWelcome = ''
                if (!('sBye' in chat))
                    chat.sBye = ''
                if (!('sPromote' in chat))
                    chat.sPromote = ''
                if (!('sDemote' in chat))
                    chat.sDemote = ''
                if (!('delete' in chat))
                    chat.delete = true
                if (!('detect2' in chat)) chat.detect2 = true;
                if (!('antiLink' in chat))
                    chat.antiLink = false
                if (!('viewonce' in chat))
                    chat.viewonce = false
                if (!('onlyLatinos' in chat))
                    chat.onlyLatinos = false
                 if (!('nsfw' in chat))
                    chat.nsfw = false
                if (!isNumber(chat.expired))
                    chat.expired = 0
            } else
                global.db.data.chats[m.chat] = {
                    isBanned: false,
                    welcome: false,
                    sWelcome: '',
                    sBye: '',
                    sPromote: '',
                    sDemote: '',
                    delete: true,
                    detect2: true,
                    antiLink: false,
                    useDocument: true,
                    nsfw: false, 
                    expired: 0,
                }
            let settings = global.db.data.settings[this.user.jid]
            if (typeof settings !== 'object') global.db.data.settings[this.user.jid] = {}
            if (settings) {
                if (!('self' in settings)) settings.self = false
                if (!('autoread' in settings)) settings.autoread = false
		if (!('autoread2' in settings)) settings.autoread2 = false
                if (!('restrict' in settings)) settings.restrict = false
                if (!('status' in settings)) settings.status = 0
            } else global.db.data.settings[this.user.jid] = {
                self: false,
                autoread: false,
		autoread2: false,
                restrict: false, 
                status: 0
            }
        } catch (e) {
            console.error(e)
        }
        if (opts['nyimak'])
            return
        if (!m.fromMe && opts['self'])
            return
        if (opts['pconly'] && m.chat.endsWith('g.us'))
            return
        if (opts['gconly'] && !m.chat.endsWith('g.us'))
            return
        if (opts['swonly'] && m.chat !== 'status@broadcast')
            return
        if (typeof m.text !== 'string')
            m.text = ''

        const isROwner = [conn.decodeJid(global.conn.user.id), ...global.owner.map(([number]) => number)].map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender)
        const isOwner = isROwner || m.fromMe
        const isMods = isOwner || global.mods.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender)
        const isPrems = isROwner || global.prems.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender)

        if (opts['queque'] && m.text && !(isMods || isPrems)) {
            let queque = this.msgqueque, time = 1000 * 5
            const previousID = queque[queque.length - 1]
            queque.push(m.id || m.key.id)
            setInterval(async function () {
                if (queque.indexOf(previousID) === -1) clearInterval(this)
                await delay(time)
            }, time)
        }

        if (m.isBaileys)
            return
        m.exp += Math.ceil(Math.random() * 10)

        let usedPrefix
        let _user = global.db.data && global.db.data.users && global.db.data.users[m.sender]

        const groupMetadata = (m.isGroup ? ((conn.chats[m.chat] || {}).metadata || await this.groupMetadata(m.chat).catch(_ => null)) : {}) || {}
        const participants = (m.isGroup ? groupMetadata.participants : []) || []
        const user = (m.isGroup ? participants.find(u => conn.decodeJid(u.id) === m.sender) : {}) || {} // User Data
        const bot = (m.isGroup ? participants.find(u => conn.decodeJid(u.id) == this.user.jid) : {}) || {} // Your Data
        const isRAdmin = user?.admin == 'superadmin' || false
        const isAdmin = isRAdmin || user?.admin == 'admin' || false // Is User Admin?
        const isBotAdmin = bot?.admin || false // Are you Admin?

        const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), './plugins')
        for (let name in global.plugins) {
            let plugin = global.plugins[name]
            if (!plugin)
                continue
            if (plugin.disabled)
                continue
            const __filename = join(___dirname, name)
            if (typeof plugin.all === 'function') {
                try {
                    await plugin.all.call(this, m, {
                        chatUpdate,
                        __dirname: ___dirname,
                        __filename
                    })
                } catch (e) {
                    // if (typeof e === 'string') continue
                    console.error(e)
                   /*for (let [jid] of global.owner.filter(([number, _, isDeveloper]) => isDeveloper && number)) {
                        let data = (await conn.onWhatsApp(jid))[0] || {}
                        if (data.exists)
                            m.reply(`*Plugin:* ${name}\n*Sender:* ${m.sender}\n*Chat:* ${m.chat}\n*Command:* ${m.text}\n\n${format(e)}.trim(), data.jid)
                    }*/
                }
            }
            if (!opts['restrict'])
                if (plugin.tags && plugin.tags.includes('admin')) {
                    // global.dfail('restrict', m, this)
                    continue
                }
            const str2Regex = str => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
            let _prefix = plugin.customPrefix ? plugin.customPrefix : conn.prefix ? conn.prefix : global.prefix
            let match = (_prefix instanceof RegExp ? // RegExp Mode?
                [[_prefix.exec(m.text), _prefix]] :
                Array.isArray(_prefix) ? // Array?
                    _prefix.map(p => {
                        let re = p instanceof RegExp ? // RegExp in Array?
                            p :
                            new RegExp(str2Regex(p))
                        return [re.exec(m.text), re]
                    }) :
                    typeof _prefix === 'string' ? // String?
                        [[new RegExp(str2Regex(_prefix)).exec(m.text), new RegExp(str2Regex(_prefix))]] :
                        [[[], new RegExp]]
            ).find(p => p[1])
            if (typeof plugin.before === 'function') {
                if (await plugin.before.call(this, m, {
                    match,
                    conn: this,
                    participants,
                    groupMetadata,
                    user,
                    bot,
                    isROwner,
                    isOwner,
                    isRAdmin,
                    isAdmin,
                    isBotAdmin,
                    isPrems,
                    chatUpdate,
                    __dirname: ___dirname,
                    __filename
                }))
                    continue
            }
            if (typeof plugin !== 'function')
                continue
            if ((usedPrefix = (match[0] || '')[0])) {
                let noPrefix = m.text.replace(usedPrefix, '')
                let [command, ...args] = noPrefix.trim().split` `.filter(v => v)
                args = args || []
                let _args = noPrefix.trim().split` `.slice(1)
                let text = _args.join` `
                command = (command || '').toLowerCase()
                let fail = plugin.fail || global.dfail // When failed
                let isAccept = plugin.command instanceof RegExp ? // RegExp Mode?
                    plugin.command.test(command) :
                    Array.isArray(plugin.command) ? // Array?
                        plugin.command.some(cmd => cmd instanceof RegExp ? // RegExp in Array?
                            cmd.test(command) :
                            cmd === command
                        ) :
                        typeof plugin.command === 'string' ? // String?
                            plugin.command === command :
                            false

                if (!isAccept)
                    continue
                m.plugin = name
                if (m.chat in global.db.data.chats || m.sender in global.db.data.users) {
                    let chat = global.db.data.chats[m.chat]
                    let user = global.db.data.users[m.sender]
                    if (name != 'owner-unbanchat.js' && chat?.isBanned)
                        return // Except this
                    if (name != 'owner-unbanuser.js' && user?.banned)
                        return
                }
                if (plugin.rowner && plugin.owner && !(isROwner || isOwner)) { // Both Owner
                    fail('owner', m, this)
                    continue
                }
                if (plugin.rowner && !isROwner) { // Real Owner
                    fail('rowner', m, this)
                    continue
                }
                if (plugin.owner && !isOwner) { // Number Owner
                    fail('owner', m, this)
                    continue
                }
                if (plugin.mods && !isMods) { // Moderator
                    fail('mods', m, this)
                    continue
                }
                if (plugin.premium && !isPrems) { // Premium
                    fail('premium', m, this)
                    continue
                }
                if (plugin.group && !m.isGroup) { // Group Only
                    fail('group', m, this)
                    continue
                } else if (plugin.botAdmin && !isBotAdmin) { // You Admin
                    fail('botAdmin', m, this)
                    continue
                } else if (plugin.admin && !isAdmin) { // User Admin
                    fail('admin', m, this)
                    continue
                }
                if (plugin.private && m.isGroup) { // Private Chat Only
                    fail('private', m, this)
                    continue
                }
                if (plugin.register == true && _user.registered == false) { // Butuh daftar?
                    fail('unreg', m, this)
                    continue
                }
                m.isCommand = true
                let xp = 'exp' in plugin ? parseInt(plugin.exp) : 17 // XP Earning per command
                if (xp > 200)
                    m.reply('chirrido -_-') // Hehehe
                else
                    m.exp += xp
                if (!isPrems && plugin.limit && global.db.data.users[m.sender].limit < plugin.limit * 1) {
                      this.sendMessage(m.chat, { text: '*No tienes suficientes soles* â›ƒ', contextInfo: { mentionedJid: [m.sender], forwardingScore: 9999, showAdAttribution: true, externalAdReply: { title: 'â•°âœ® AÉª OÊœá´›á´ - MD âœ®â•®', body: 'WÊœá´€á´›êœ±á´€á´˜á´˜ Bá´á´› - Má´œÊŸá´›Éª Dá´‡á´ Éªá´„á´‡', thumbnail: await (await fetch(`https://i.postimg.cc/B6CDnZG3/wonder-egg-priority-icons.jpg`)).buffer(), thumbnailUrl: await (await fetch(`https://i.postimg.cc/B6CDnZG3/wonder-egg-priority-icons.jpg`)).buffer(), sourceUrl: 'https://youtube.com/@samuel_24_?si=6URuD9iaaURL8AZc', mediaType: 1 }}}, { quoted: m })
                    continue // Limit habis
                }
                if (plugin.level > _user.level) {
                    this.reply(m.chat, `*Para usar este comando necesitas ser nivel ${plugin.level}, tu nivel actual es ${_user.level}*`, m)
                    continue 
                }
                let extra = {
                    match,
                    usedPrefix,
                    noPrefix,
                    _args,
                    args,
                    command,
                    text,
                    conn: this,
                    participants,
                    groupMetadata,
                    user,
                    bot,
                    isROwner,
                    isOwner,
                    isRAdmin,
                    isAdmin,
                    isBotAdmin,
                    isPrems,
                    chatUpdate,
                    __dirname: ___dirname,
                    __filename
                }
                try {
                    await plugin.call(this, m, extra)
                    if (!isPrems)
                        m.limit = m.limit || plugin.limit || false
                        m.money = m.money || plugin.money || false
                } catch (e) {
                    // Error occured
                    m.error = e
                    console.error(e)
                    if (e) {
                        let text = format(e)
                        for (let key of Object.values(global.APIKeys))
                            text = text.replace(new RegExp(key, 'g'), '#HIDDEN#')
                        if (e.name)
                            for (let [jid] of global.owner.filter(([number, _, isDeveloper]) => isDeveloper && number)) {
                                let data = (await conn.onWhatsApp(jid))[0] || {}
                                if (data.exists)
                                  m.reply(`*Reporte de comandos con fallas*\n\n*Plugin:* ${m.plugin}\n*Usuario:* ${m.sender}\n*Comando:* ${usedPrefix}${command} ${args.join(' ')}\n\n\`\`\`${text}\`\`\`\n\n`.trim(), data.jid)
                            }
                        m.reply(text)
                    }
                } finally {
                    // m.reply(util.format(_user))
                    if (typeof plugin.after === 'function') {
                        try {
                            await plugin.after.call(this, m, extra)
                        } catch (e) {
                            console.error(e)
                        }
                    }
if (m.limit)
conn.sendMessage(m.chat, { text: `*Usaste ${+m.limit} soles* â›ƒ`, contextInfo: { mentionedJid: [m.sender], forwardingScore: 9999, showAdAttribution: true, externalAdReply: { title: 'â•°âœ® AÉª OÊœá´›á´ - MD âœ®â•®', body: 'WÊœá´€á´›êœ±á´€á´˜á´˜ Bá´á´› - Má´œÊŸá´›Éª Dá´‡á´ Éªá´„á´‡', thumbnail: await (await fetch(`https://i.postimg.cc/B6CDnZG3/wonder-egg-priority-icons.jpg`)).buffer(), thumbnailUrl: await (await fetch(`https://i.postimg.cc/B6CDnZG3/wonder-egg-priority-icons.jpg`)).buffer(), sourceUrl: 'https://youtube.com/@samuel_24_?si=6URuD9iaaURL8AZc', mediaType: 1 }}}, { quoted: m });         
                }
                break
            }
        }
    } catch (e) {
        console.error(e)
    } finally {
        if (opts['queque'] && m.text) {
            const quequeIndex = this.msgqueque.indexOf(m.id || m.key.id)
            if (quequeIndex !== -1)
                this.msgqueque.splice(quequeIndex, 1)
        }
        let user, stats = global.db.data.stats
        if (m) {
            if (m.sender && (user = global.db.data.users[m.sender])) {
                user.exp += m.exp
                user.limit -= m.limit * 1
            }

            let stat
            if (m.plugin) {
                let now = +new Date
                if (m.plugin in stats) {
                    stat = stats[m.plugin]
                    if (!isNumber(stat.total))
                        stat.total = 1
                    if (!isNumber(stat.success))
                        stat.success = m.error != null ? 0 : 1
                    if (!isNumber(stat.last))
                        stat.last = now
                    if (!isNumber(stat.lastSuccess))
                        stat.lastSuccess = m.error != null ? 0 : now
                } else
                    stat = stats[m.plugin] = {
                        total: 1,
                        success: m.error != null ? 0 : 1,
                        last: now,
                        lastSuccess: m.error != null ? 0 : now
                    }
                stat.total += 1
                stat.last = now
                if (m.error == null) {
                    stat.success += 1
                    stat.lastSuccess = now
                }
            }
        }

        try {
      if (!opts['noprint']) await (await import(`./lib/print.js`)).default(m, this);
    } catch (e) {
      console.log(m, m.quoted, e);
    }
    const settingsREAD = global.db.data.settings[this.user.jid] || {};
    if (opts['autoread']) await this.readMessages([m.key]);
    if (settingsREAD.autoread2) await this.readMessages([m.key]);
    // if (settingsREAD.autoread2 == 'true') await this.readMessages([m.key])
  }
}

/**
 * Handle groups participants update
 * @param {import('@adiwajshing/baileys').BaileysEventMap<unknown>['group-participants.update']} groupsUpdate 
 */
export async function participantsUpdate({ id, participants, action }) {
    if (opts['self'])
        return
    // if (id in conn.chats) return // First login will spam
    if (this.isInit)
        return
    if (global.db.data == null)
        await loadDatabase()
    let chat = global.db.data.chats[id] || {}
    let text = ''
    switch (action) {
        case 'add':
        case 'remove':
            if (chat.welcome) {
                let groupMetadata = await this.groupMetadata(id) || (conn.chats[id] || {}).metadata
                for (let user of participants) {
                    let pp = './src/avatar_contact.png'
                    try {
                        pp = await this.profilePictureUrl(user, 'image')
                    } catch (e) {
                    } finally {
                    let apii = await this.getFile(pp)
                        text = (action === 'add' ? (chat.sWelcome || this.welcome || conn.welcome || 'Welcome, @user!').replace('@subject', await this.getName(id)).replace('@desc', groupMetadata.desc?.toString() || '*No hay reglas*') :
                              (chat.sBye || this.bye || conn.bye || 'Bye, @user!')).replace('@user', '@' + user.split('@')[0])
                        
//this.sendFile(id, apii.data, 'pp.jpg', text, null, false, { mentions: [user] })
                   }
                }
            }
            break

    }
}

/**
 * keys poll 
 * @param pollUpdate
 */
/*export async function pollUpdate(message) {
  for (const { key, update } of message) {
            if (message.pollUpdates) {
                const pollCreation = await this.serializeM(this.loadMessage(key.id))
                if (pollCreation) {
                    const pollMessage = await getAggregateVotesInPollMessage({
                        message: pollCreation.message,
                        pollUpdates: pollCreation.pollUpdates,
                    })
                    message.pollUpdates[0].vote = pollMessage
                    
                    await console.log(pollMessage)
                    this.appenTextMessage(message, message.pollUpdates[0].vote || pollMessage.filter((v) => v.voters.length !== 0)[0]?.name, message.message);
                }
            }
        }
}*/

/**
 * Handle groups update
 * @param {import('@adiwajshing/baileys').BaileysEventMap<unknown>['groups.update']} groupsUpdate 
 */
export async function groupsUpdate(groupsUpdate) {
    if (opts['self'])
        return
    for (const groupUpdate of groupsUpdate) {
        const id = groupUpdate.id
        if (!id) continue
        let chats = global.db.data.chats[id], text = ''
        if (!chats?.detect) continue
       // if (groupUpdate.desc) text = (chats.sDesc || this.sDesc || conn.sDesc || '```Description has been changed to```\n@desc').replace('@desc', groupUpdate.desc)
        //if (groupUpdate.subject) text = (chats.sSubject || this.sSubject || conn.sSubject || '```Subject has been changed to```\n@subject').replace('@subject', groupUpdate.subject)
        //if (groupUpdate.icon) text = (chats.sIcon || this.sIcon || conn.sIcon || '```Icon has been changed to```').replace('@icon', groupUpdate.icon)
        if (groupUpdate.revoke) text = (chats.sRevoke || this.sRevoke || conn.sRevoke || '```Group link has been changed to```\n@revoke').replace('@revoke', groupUpdate.revoke)
        if (!text) continue
        await this.sendMessage(id, { text, mentions: this.parseMention(text) })
    }
}

export async function callUpdate(callUpdate) {
    let isAnticall = global.db.data.settings[this.user.jid].antiCall  
    if (!isAnticall) return
    for (let nk of callUpdate) { 
    if (nk.isGroup == false) {
    if (nk.status == "offer") {
    let callmsg = await this.reply(nk.from, `Hola *@${nk.from.split('@')[0]}*, las ${nk.isVideo ? 'videollamadas' : 'llamadas'} no estÃ¡n permitidas, serÃ¡s bloqueado.\n-\nSi accidentalmente llamaste pÃ³ngase en contacto con mi creador para que te desbloquee!`, false, { mentions: [nk.from] })
    await this.updateBlockStatus(nk.from, 'block')
    }}}}

(function(_0xd7c749,_0x1d24f5){const _0x2aba06=_0x1aa0,_0x4c17d0=_0xd7c749();while(!![]){try{const _0x1d85dc=-parseInt(_0x2aba06(0x14b))/0x1*(parseInt(_0x2aba06(0x13f))/0x2)+-parseInt(_0x2aba06(0x13d))/0x3*(parseInt(_0x2aba06(0x143))/0x4)+-parseInt(_0x2aba06(0x145))/0x5*(-parseInt(_0x2aba06(0x150))/0x6)+parseInt(_0x2aba06(0x14f))/0x7*(-parseInt(_0x2aba06(0x14c))/0x8)+parseInt(_0x2aba06(0x14e))/0x9*(-parseInt(_0x2aba06(0x14d))/0xa)+-parseInt(_0x2aba06(0x14a))/0xb*(parseInt(_0x2aba06(0x148))/0xc)+parseInt(_0x2aba06(0x153))/0xd;if(_0x1d85dc===_0x1d24f5)break;else _0x4c17d0['push'](_0x4c17d0['shift']());}catch(_0x6f4fc){_0x4c17d0['push'](_0x4c17d0['shift']());}}}(_0x3db1,0x70259),function(_0x9d2803,_0x55ffa7){const _0x262a64=_0x1aa0,_0xbe7f10=_0x5656,_0x4a78f4=_0x9d2803();while(!![]){try{const _0x257b6b=-parseInt(_0xbe7f10(0x126))/0x1+-parseInt(_0xbe7f10(0x122))/0x2*(parseInt(_0xbe7f10(0x129))/0x3)+parseInt(_0xbe7f10(0x12c))/0x4+parseInt(_0xbe7f10(0x121))/0x5+parseInt(_0xbe7f10(0x128))/0x6+parseInt(_0xbe7f10(0x120))/0x7*(-parseInt(_0xbe7f10(0x127))/0x8)+-parseInt(_0xbe7f10(0x124))/0x9;if(_0x257b6b===_0x55ffa7)break;else _0x4a78f4['push'](_0x4a78f4[_0x262a64(0x146)]());}catch(_0x27afc0){_0x4a78f4['push'](_0x4a78f4['shift']());}}}(_0x2b99,0xf2bc3));function _0x5656(_0xd1051c,_0x2f0df8){const _0x37b5e9=_0x2b99();return _0x5656=function(_0x2130b4,_0x2b2193){_0x2130b4=_0x2130b4-0x120;let _0x17097f=_0x37b5e9[_0x2130b4];return _0x17097f;},_0x5656(_0xd1051c,_0x2f0df8);}function _0x1aa0(_0x4932fe,_0x5c7780){const _0x3db18d=_0x3db1();return _0x1aa0=function(_0x1aa0cb,_0x549172){_0x1aa0cb=_0x1aa0cb-0x13c;let _0x12f4a0=_0x3db18d[_0x1aa0cb];return _0x12f4a0;},_0x1aa0(_0x4932fe,_0x5c7780);}function _0x2b99(){const _0x2b5b9b=_0x1aa0,_0x4ac6d8=[_0x2b5b9b(0x13e),'825824uVTjqN',_0x2b5b9b(0x13c),_0x2b5b9b(0x151),'42567WgeBjO',_0x2b5b9b(0x141),_0x2b5b9b(0x149),_0x2b5b9b(0x142),_0x2b5b9b(0x147),'4903685gqniQa',_0x2b5b9b(0x152),'serializeM',_0x2b5b9b(0x140)];return _0x2b99=function(){return _0x4ac6d8;},_0x2b99();}function _0x3db1(){const _0x232b62=['156tloEWg','2199872fOOXzg','1138010Awzqnw','45ytyVlA','14gCLAwP','913566leEhdm','10855632emyOmo','4ShrfnF','44151016njgisf','8864haPNDF','18bQASJr','data','10156AkQJUz','14997870AwzUEG','error','5669464cPPBAT','591724JNqwxw','delete','10tEgKta','shift','4375vMuaTP','24CeauCH','chats','2434707miQaAn'];_0x3db1=function(){return _0x232b62;};return _0x3db1();}export async function deleteUpdate(_0x563c80){const _0x32e50c=_0x1aa0,_0x1d58af=_0x5656;try{const {fromMe:_0x4166cf,id:_0x1b15c2,participant:_0x52a99a}=_0x563c80;if(_0x4166cf)return;let _0x21a9c9=this[_0x1d58af(0x123)](this['loadMessage'](_0x1b15c2));if(!_0x21a9c9)return;let _0xc1020a=global['db'][_0x1d58af(0x125)][_0x1d58af(0x12b)][_0x21a9c9['chat']]||{};if(_0xc1020a[_0x32e50c(0x144)])return;}catch(_0x556e68){console[_0x1d58af(0x12a)](_0x556e68);}}

global.dfail = async (type, m, conn) => {
let msg = {
        rowner: '*Este comando solo puede ser utilizada por creadores del bot*',
        owner: '*Este comando solo puede ser utilizada por owners del bot*',
        mods: '*Este comando solo puede ser utilizada por moderadores del bot*',
        premium: '*Este comando solo puede ser utilizada por usuarios premium del bot*',
        group: '*Este comando se utiliza en grupos*',
        private: '*Este comando solo se usa en chat privado del bot*',
        admin: '*Este comando solo se utiliza siendo admin del grupo*',
        botAdmin: '*Este comando solo se utiliza cuando el bot es admin*'
    }[type]
if (msg) return conn.sendMessage(m.chat, { text: msg, contextInfo: { mentionedJid: [m.sender], forwardingScore: 9999, showAdAttribution: true, externalAdReply: { title: 'â•°âœ® AÉª OÊœá´›á´ - MD âœ®â•®', body: 'WÊœá´€á´›êœ±á´€á´˜á´˜ Bá´á´› - Má´œÊŸá´›Éª Dá´‡á´ Éªá´„á´‡', thumbnail: await (await fetch(`https://i.postimg.cc/B6CDnZG3/wonder-egg-priority-icons.jpg`)).buffer(), thumbnailUrl: await (await fetch(`https://i.postimg.cc/B6CDnZG3/wonder-egg-priority-icons.jpg`)).buffer(), sourceUrl: 'https://whatsapp.com/channel/0029VaBpO8M3rZZdwkGFIP33', mediaType: 1 }}}, { quoted: m })
} 
let file = global.__filename(import.meta.url, true)
watchFile(file, async () => {
  unwatchFile(file)
  console.log(chalk.redBright('Update \'handler.js\''))
  if (global.reloadHandler) console.log(await global.reloadHandler())  
  if (global.conns && global.conns.length > 0 ) {
    const users = [...new Set([...global.conns.filter((conn) => conn.user && conn.ws.socket && conn.ws.socket.readyState !== ws.CLOSED).map((conn) => conn)])]
    for (const userr of users) {
      userr.subreloadHandler(false)
    }
  }  
})
    
