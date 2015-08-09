// Generated by CoffeeScript 1.9.3
(function() {
  var Deck, Inotify, Room, User, WebSocketServer, _, bunyan, debug, dialogues, execFile, fs, http, http_server, i, inotify, level_points, log, mycard, net, originIsAllowed, os, path, request, settings, tips, url, victories, waiting, wsServer, ygopro,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  net = require('net');

  http = require('http');

  url = require('url');

  path = require('path');

  fs = require('fs');

  os = require('os');

  execFile = require('child_process').execFile;

  _ = require('underscore');

  _.str = require('underscore.string');

  _.mixin(_.str.exports());

  Inotify = require('inotify').Inotify;

  WebSocketServer = require('websocket').server;

  request = require('request');

  bunyan = require('bunyan');

  settings = require('./config.json');

  ygopro = require('./ygopro.js');

  mycard = require('./mycard.js');

  Room = require('./room.js');

  if (settings.modules.database) {
    User = require('./user.js');
  }

  if (settings.modules.database) {
    Deck = require('./deck.js');
  }

  victories = require('./victories.json');

  debug = false;

  log = null;

  if (process.argv[2] === '--debug') {
    settings.port++;
    if (settings.modules.http) {
      settings.modules.http.port++;
    }
    log = bunyan.createLogger({
      name: "mycard-debug"
    });
  } else {
    log = bunyan.createLogger({
      name: "mycard"
    });
  }

  net.createServer(function(client) {
    var ctos_buffer, ctos_message_length, ctos_proto, server, stoc_buffer, stoc_message_length, stoc_proto;
    server = new net.Socket();
    client.server = server;
    client.on('close', function(had_error) {
      log.info("client closed", client.name, had_error);
      if (client.room && client.room.started && indexOf.call(client.room.dueling_players, client) >= 0 && !client.room.disconnector) {
        client.room.disconnector = client;
      }
      if (!client.closed) {
        client.closed = true;
        if (client.room) {
          client.room.disconnect(client);
        }
      }
      return server.end();
    });
    client.on('error', function(error) {
      log.info("client error", client.name, error);
      if (client.room && client.room.started && indexOf.call(client.room.dueling_players, client) >= 0 && !client.room.disconnector) {
        client.room.disconnector = client;
      }
      if (!client.closed) {
        client.closed = error;
        if (client.room) {
          client.room.disconnect(client, error);
        }
      }
      return server.end();
    });
    server.on('close', function(had_error) {
      log.info("server closed", client.name, had_error);
      if (!server.closed) {
        server.closed = true;
      }
      if (client.room && client.room.started && indexOf.call(client.room.dueling_players, client) >= 0 && !client.room.disconnector) {
        client.room.disconnector = 'server';
      }
      if (!client.closed) {
        ygopro.stoc_send_chat(client, "服务器关闭了连接");
        return client.end();
      }
    });
    server.on('error', function(error) {
      log.info("server error", client.name, error);
      server.closed = error;
      if (client.room && client.room.started && indexOf.call(client.room.dueling_players, client) >= 0 && !client.room.disconnector) {
        client.room.disconnector = 'server';
      }
      if (!client.closed) {
        ygopro.stoc_send_chat(client, "服务器错误: " + error);
        return client.end();
      }
    });
    ctos_buffer = new Buffer(0);
    ctos_message_length = 0;
    ctos_proto = 0;
    client.pre_establish_buffers = new Array();
    client.on('data', function(data) {
      var b, results, struct;
      if (client.is_post_watcher) {
        return client.room.watcher.write(data);
      } else {
        ctos_buffer = Buffer.concat([ctos_buffer, data], ctos_buffer.length + data.length);
        if (client.established) {
          server.write(data);
        } else {
          client.pre_establish_buffers.push(data);
        }
        results = [];
        while (true) {
          if (ctos_message_length === 0) {
            if (ctos_buffer.length >= 2) {
              results.push(ctos_message_length = ctos_buffer.readUInt16LE(0));
            } else {
              break;
            }
          } else if (ctos_proto === 0) {
            if (ctos_buffer.length >= 3) {
              results.push(ctos_proto = ctos_buffer.readUInt8(2));
            } else {
              break;
            }
          } else {
            if (ctos_buffer.length >= 2 + ctos_message_length) {
              if (ygopro.ctos_follows[ctos_proto]) {
                b = ctos_buffer.slice(3, ctos_message_length - 1 + 3);
                if (struct = ygopro.structs[ygopro.proto_structs.CTOS[ygopro.constants.CTOS[ctos_proto]]]) {
                  struct._setBuff(b);
                  ygopro.ctos_follows[ctos_proto].callback(b, _.clone(struct.fields), client, server);
                } else {
                  ygopro.ctos_follows[ctos_proto].callback(b, null, client, server);
                }
              }
              ctos_buffer = ctos_buffer.slice(2 + ctos_message_length);
              ctos_message_length = 0;
              results.push(ctos_proto = 0);
            } else {
              break;
            }
          }
        }
        return results;
      }
    });
    stoc_buffer = new Buffer(0);
    stoc_message_length = 0;
    stoc_proto = 0;
    return server.on('data', function(data) {
      var b, results, stanzas, struct;
      stoc_buffer = Buffer.concat([stoc_buffer, data], stoc_buffer.length + data.length);
      client.write(data);
      results = [];
      while (true) {
        if (stoc_message_length === 0) {
          if (stoc_buffer.length >= 2) {
            results.push(stoc_message_length = stoc_buffer.readUInt16LE(0));
          } else {
            break;
          }
        } else if (stoc_proto === 0) {
          if (stoc_buffer.length >= 3) {
            results.push(stoc_proto = stoc_buffer.readUInt8(2));
          } else {
            break;
          }
        } else {
          if (stoc_buffer.length >= 2 + stoc_message_length) {
            stanzas = stoc_proto;
            if (ygopro.stoc_follows[stoc_proto]) {
              b = stoc_buffer.slice(3, stoc_message_length - 1 + 3);
              if (struct = ygopro.structs[ygopro.proto_structs.STOC[ygopro.constants.STOC[stoc_proto]]]) {
                struct._setBuff(b);
                ygopro.stoc_follows[stoc_proto].callback(b, _.clone(struct.fields), client, server);
              } else {
                ygopro.stoc_follows[stoc_proto].callback(b, null, client, server);
              }
            }
            stoc_buffer = stoc_buffer.slice(2 + stoc_message_length);
            stoc_message_length = 0;
            results.push(stoc_proto = 0);
          } else {
            break;
          }
        }
      }
      return results;
    });
  }).listen(settings.port, function() {
    return log.info("server started", settings.ip, settings.port);
  });

  ygopro.ctos_follow('PLAYER_INFO', true, function(buffer, info, client, server) {
    return client.name = info.name;
  });

  ygopro.ctos_follow('JOIN_GAME', false, function(buffer, info, client, server) {
    var j, len, ref;
    if (info.version !== settings.version) {
      ygopro.stoc_send(client, 'ERROR_MSG', {
        msg: 4,
        code: settings.version
      });
      return client.end();
    } else if (!info.pass.length) {
      ygopro.stoc_send_chat(client, "房间为空，请修改房间名");
      ygopro.stoc_send(client, 'ERROR_MSG', {
        msg: 1,
        code: 2
      });
      return client.end();
    } else if ((os.freemem() / os.totalmem()) >= 0.9) {
      ygopro.stoc_send_chat(client, "服务器已经爆满，请稍候再试");
      ygopro.stoc_send(client, 'ERROR_MSG', {
        msg: 1,
        code: 2
      });
      return client.end();
    } else if (!Room.validate(info.pass)) {
      ygopro.stoc_send_chat(client, "房间密码不正确");
      ygopro.stoc_send(client, 'ERROR_MSG', {
        msg: 1,
        code: 2
      });
      return client.end();
    } else if (client.name === '[INCORRECT]') {
      ygopro.stoc_send(client, 'ERROR_MSG', {
        msg: 1,
        code: 2
      });
      return client.end();
    } else {
      log.info('join_game', info.pass, client.name);
      client.room = Room.find_or_create_by_name(info.pass);
      if (client.room.started) {
        if (settings.modules.post_start_watching) {
          client.is_post_watcher = true;
          ygopro.stoc_send_chat_to_room(client.room, client.name + " 加入了观战");
          client.room.watchers.push(client);
          ref = client.room.watcher_buffers;
          for (j = 0, len = ref.length; j < len; j++) {
            buffer = ref[j];
            client.write(buffer);
          }
          return ygopro.stoc_send_chat(client, "观战中.");
        } else {
          ygopro.stoc_send_chat(client, "决斗已开始");
          ygopro.stoc_send(client, 'ERROR_MSG', {
            msg: 1,
            code: 2
          });
          return client.end();
        }
      } else {
        return client.room.connect(client);
      }
    }
  });

  ygopro.stoc_follow('JOIN_GAME', false, function(buffer, info, client, server) {
    var watcher;
    if (settings.modules.welcome) {
      ygopro.stoc_send_chat(client, settings.modules.welcome);
    }
    if ((os.freemem() / os.totalmem()) >= 0.9) {
      ygopro.stoc_send_chat(client, "服务器已经爆满，随时存在崩溃风险！");
    }
    if (settings.modules.database) {
      if (_.startsWith(client.room.name, 'M#')) {
        User.findOne({
          name: client.name
        }, function(err, user) {
          if (!user) {
            user = new User({
              name: client.name,
              points: 0
            });
            user.save();
          }
          return User.count({
            points: {
              $gt: user.points
            }
          }, function(err, count) {
            var rank;
            rank = count + 1;
            return ygopro.stoc_send_chat(client, "积分系统测试中，你现在有" + user.points + "点积分，排名" + rank + "，这些积分以后正式使用时会重置");
          });
        });
      }
    }
    if (settings.modules.post_start_watching && !client.room.watcher) {
      client.room.watcher = watcher = net.connect(client.room.port, function() {
        ygopro.ctos_send(watcher, 'PLAYER_INFO', {
          name: "the Big Brother"
        });
        ygopro.ctos_send(watcher, 'JOIN_GAME', {
          version: settings.version,
          gameid: 2577,
          some_unknown_mysterious_fucking_thing: 0,
          pass: ""
        });
        return ygopro.ctos_send(watcher, 'HS_TOOBSERVER');
      });
      watcher.ws_buffer = new Buffer(0);
      watcher.ws_message_length = 0;
      client.room.watcher_stanzas = [];
      watcher.on('data', function(data) {
        var j, k, len, len1, ref, ref1, results, stanza, w;
        client.room.watcher_buffers.push(data);
        ref = client.room.watchers;
        for (j = 0, len = ref.length; j < len; j++) {
          w = ref[j];
          if (w) {
            w.write(data);
          }
        }
        watcher.ws_buffer = Buffer.concat([watcher.ws_buffer, data], watcher.ws_buffer.length + data.length);
        results = [];
        while (true) {
          if (watcher.ws_message_length === 0) {
            if (watcher.ws_buffer.length >= 2) {
              results.push(watcher.ws_message_length = watcher.ws_buffer.readUInt16LE(0));
            } else {
              break;
            }
          } else {
            if (watcher.ws_buffer.length >= 2 + watcher.ws_message_length) {
              stanza = watcher.ws_buffer.slice(2, watcher.ws_message_length + 2);
              ref1 = client.room.ws_watchers;
              for (k = 0, len1 = ref1.length; k < len1; k++) {
                w = ref1[k];
                if (w) {
                  w.sendBytes(stanza);
                }
              }
              client.room.watcher_stanzas.push(stanza);
              watcher.ws_buffer = watcher.ws_buffer.slice(2 + watcher.ws_message_length);
              results.push(watcher.ws_message_length = 0);
            } else {
              break;
            }
          }
        }
        return results;
      });
      watcher.on('error', function(error) {
        return log.error("watcher error", error);
      });
      return watcher.on('close', function(had_error) {
        var j, len, ref, results, w;
        ref = client.room.ws_watchers;
        results = [];
        for (j = 0, len = ref.length; j < len; j++) {
          w = ref[j];
          results.push(w.close());
        }
        return results;
      });
    }
  });

  if (settings.modules.dialogues) {
    dialogues = {};
    request({
      url: settings.modules.dialogues,
      json: true
    }, function(error, response, body) {
      if (_.isString(body)) {
        return log.warn("dialogues bad json", body);
      } else if (error || !body) {
        return log.warn('dialogues error', error, response);
      } else {
        log.info("dialogues loaded", _.size(body));
        return dialogues = body;
      }
    });
  }

  ygopro.stoc_follow('GAME_MSG', false, function(buffer, info, client, server) {
    var card, j, len, line, msg, playertype, pos, reason, ref, ref1, ref2, results, val;
    msg = buffer.readInt8(0);
    if (ygopro.constants.MSG[msg] === 'START') {
      playertype = buffer.readUInt8(1);
      client.is_first = !(playertype & 0xf);
      client.lp = client.room.hostinfo.start_lp;
    }
    if (ygopro.constants.MSG[msg] === 'WIN' && _.startsWith(client.room.name, 'M#') && client.is_host) {
      pos = buffer.readUInt8(1);
      if (!(client.is_first || pos === 2)) {
        pos = 1 - pos;
      }
      reason = buffer.readUInt8(2);
      log.info({
        winner: pos,
        reason: reason
      });
      client.room.duels.push({
        winner: pos,
        reason: reason
      });
    }
    if (ygopro.constants.MSG[msg] === 'DAMAGE' && client.is_host) {
      pos = buffer.readUInt8(1);
      if (!client.is_first) {
        pos = 1 - pos;
      }
      val = buffer.readInt32LE(2);
      client.room.dueling_players[pos].lp -= val;
      if ((0 < (ref = client.room.dueling_players[pos].lp) && ref <= 100)) {
        ygopro.stoc_send_chat_to_room(client.room, "你的生命已经如风中残烛了！");
      }
    }
    if (ygopro.constants.MSG[msg] === 'RECOVER' && client.is_host) {
      pos = buffer.readUInt8(1);
      if (!client.is_first) {
        pos = 1 - pos;
      }
      val = buffer.readInt32LE(2);
      client.room.dueling_players[pos].lp += val;
    }
    if (ygopro.constants.MSG[msg] === 'LPUPDATE' && client.is_host) {
      pos = buffer.readUInt8(1);
      if (!client.is_first) {
        pos = 1 - pos;
      }
      val = buffer.readInt32LE(2);
      client.room.dueling_players[pos].lp = val;
    }
    if (ygopro.constants.MSG[msg] === 'PAY_LPCOST' && client.is_host) {
      pos = buffer.readUInt8(1);
      if (!client.is_first) {
        pos = 1 - pos;
      }
      val = buffer.readInt32LE(2);
      client.room.dueling_players[pos].lp -= val;
      if ((0 < (ref1 = client.room.dueling_players[pos].lp) && ref1 <= 100)) {
        ygopro.stoc_send_chat_to_room(client.room, "背水一战！");
      }
    }
    if (settings.modules.dialogues) {
      if (ygopro.constants.MSG[msg] === 'SUMMONING' || ygopro.constants.MSG[msg] === 'SPSUMMONING') {
        card = buffer.readUInt32LE(1);
        if (dialogues[card]) {
          ref2 = _.lines(dialogues[card][Math.floor(Math.random() * dialogues[card].length)]);
          results = [];
          for (j = 0, len = ref2.length; j < len; j++) {
            line = ref2[j];
            results.push(ygopro.stoc_send_chat(client, line));
          }
          return results;
        }
      }
    }
  });


  /*
  #房间管理
  ygopro.stoc_follow 'HS_PLAYER_ENTER', false, (buffer, info, client, server)->
    #console.log "PLAYER_ENTER to #{client.name}: #{info.name}, #{info.pos}"
    #room = client.room
    #if !room
     *  console.log "[WARN]player_enter: can't find room by player #{client.player}"
     *  return
    #room.pos_name[info.pos] = info.name
  
  ygopro.stoc_follow 'HS_PLAYER_CHANGE', false, (buffer, info, client, server)->
    #client.ready = info.status & 0xF != 0
    #client.pos = info.status >> 4
    #console.log "PLAYER_CHANGE to #{client.name}: #{info.status & 0xF != 0}, #{info.status >> 4}"
   */

  ygopro.stoc_follow('TYPE_CHANGE', false, function(buffer, info, client, server) {
    var is_host, selftype;
    selftype = info.type & 0xf;
    is_host = ((info.type >> 4) & 0xf) !== 0;
    client.is_host = is_host;
    return client.pos = selftype;
  });

  ygopro.stoc_send_random_tip = function(client) {
    if (tips) {
      return ygopro.stoc_send_chat(client, "Tip: " + tips[Math.floor(Math.random() * tips.length)]);
    }
  };

  tips = null;

  if (settings.modules.tips) {
    request({
      url: settings.modules.tips,
      json: true
    }, function(error, response, body) {
      tips = body;
      return log.info("tips loaded", tips.length);
    });
  }

  ygopro.stoc_follow('DUEL_START', false, function(buffer, info, client, server) {
    var j, len, player, ref;
    if (!client.room.started) {
      client.room.started = true;
      client.room.duels = [];
      client.room.dueling_players = [];
      ref = client.room.players;
      for (j = 0, len = ref.length; j < len; j++) {
        player = ref[j];
        if (!(player.pos !== 7)) {
          continue;
        }
        client.room.dueling_players[player.pos] = player;
        if (!player.main) {
          log.error('WTF', client);
        } else {
          player.deck = mycard.load_card_usages_from_cards(player.main, player.side);
        }
      }
      if (!client.room.dueling_players[0] || !client.room.dueling_players[1]) {
        log.error('incomplete room', client.room.dueling_players, client.room.players);
      }
    }
    if (settings.modules.tips) {
      return ygopro.stoc_send_random_tip(client);
    }
  });

  ygopro.ctos_follow('CHAT', false, function(buffer, info, client, server) {
    switch (_.trim(info.msg)) {
      case '/ping':
        return execFile('ss', ['-it', "dst " + client.remoteAddress + ":" + client.remotePort], function(error, stdout, stderr) {
          var line;
          if (error) {
            return ygopro.stoc_send_chat_to_room(client.room, error);
          } else {
            line = _.lines(stdout)[2];
            if (line.indexOf('rtt') !== -1) {
              return ygopro.stoc_send_chat_to_room(client.room, line);
            } else {
              log.warn('ping', stdout);
              return ygopro.stoc_send_chat_to_room(client.room, stdout);
            }
          }
        });
      case '/ranktop':
        if (settings.modules.database) {
          return User.find(null, null, {
            sort: {
              points: -1
            },
            limit: 8
          }, function(err, users) {
            var index, results, user;
            if (err) {
              return log.error('ranktop', err);
            }
            results = [];
            for (index in users) {
              user = users[index];
              results.push(ygopro.stoc_send_chat(client, [parseInt(index) + 1, user.points, user.name].join(' ')));
            }
            return results;
          });
        }
        break;
      case '/help':
        ygopro.stoc_send_chat(client, "Mycard MatchServer 指令帮助");
        ygopro.stoc_send_chat(client, "/help 显示这个帮助信息");
        if (settings.modules.tips) {
          ygopro.stoc_send_chat(client, "/tip 显示一条提示");
        }
        return ygopro.stoc_send_chat(client, "/senddeck 发送自己的卡组");
      case '/tip':
        if (settings.modules.tips) {
          return ygopro.stoc_send_random_tip(client);
        }
        break;
      case '/senddeck':
        if (client.deck != null) {
          ygopro.stoc_send_chat(client, "正在读取卡组信息... ");
          return mycard.deck_url_short(client.name, client.deck, function(url) {
            return ygopro.stoc_send_chat_to_room(client.room, "卡组链接: " + url);
          });
        } else {
          return ygopro.stoc_send_chat_to_room(client.room, "读取卡组信息失败");
        }
        break;
      case '/admin showroom':
        return log.info(client.room);
    }
  });

  ygopro.ctos_follow('UPDATE_DECK', false, function(buffer, info, client, server) {
    var i, main, side;
    log.info(info);
    main = (function() {
      var j, ref, results;
      results = [];
      for (i = j = 0, ref = info.mainc; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
        results.push(info.deckbuf[i]);
      }
      return results;
    })();
    side = (function() {
      var j, ref, ref1, results;
      results = [];
      for (i = j = ref = info.mainc, ref1 = info.mainc + info.sidec; ref <= ref1 ? j < ref1 : j > ref1; i = ref <= ref1 ? ++j : --j) {
        results.push(info.deckbuf[i]);
      }
      return results;
    })();
    client.main = main;
    return client.side = side;
  });

  if (settings.modules.skip_empty_side) {
    ygopro.stoc_follow('CHANGE_SIDE', false, function(buffer, info, client, server) {
      if (!_.any(client.deck, function(card_usage) {
        return card_usage.side;
      })) {
        ygopro.ctos_send(server, 'UPDATE_DECK', {
          mainc: client.main.length,
          sidec: 0,
          deckbuf: client.main
        });
        return ygopro.stoc_send_chat(client, '等待更换副卡组中...');
      }
    });
  }


  /*
   * 开包大战
  
  packs_weighted_cards = {}
  for pack, cards of require './packs.json'
    packs_weighted_cards[pack] = []
    for card in cards
      for i in [0..card.count]
        packs_weighted_cards[pack].push card.card
  
  console.log packs_weighted_cards
  
  ygopro.ctos_follow 'UPDATE_DECK', false, (buffer, info, client, server)->
    ygopro.ctos_send server, 'HS_NOTREADY'
  
    deck = []
    for pack in client.player
      for i in [0...5]
        deck.push packs_weighted_cards[pack][Math.floor(Math.random()*packs_weighted_cards[pack].length)]
  
  
    ygopro.ctos_send server, 'UPDATE_DECK', {
      mainc: deck.length,
      sidec: 0,
      deckbuf: deck
    }
    ygopro.ctos_send server, 'HS_READY'
   */

  if (settings.modules.http) {
    level_points = require('./level_points.json');
    waiting = [[]];
    for (i in level_points) {
      waiting.push([]);
    }
    log.info('level_points loaded', level_points);
    http_server = http.createServer(function(request, response) {
      var level, name, password, player, ref, ref1, room, roomsjson, u;
      u = url.parse(request.url);
      if (u.pathname === '/count.json') {
        response.writeHead(200);
        return response.end(Room.all.length.toString());
      } else if (u.pathname === '/match') {
        if (request.headers['authorization']) {
          ref1 = new Buffer((ref = request.headers['authorization'].split(/\s+/).pop()) != null ? ref : '', 'base64').toString().split(':'), name = ref1[0], password = ref1[1];
          return User.findOne({
            name: name
          }, function(err, user) {
            var index, level, points;
            if (!user) {
              user = new User({
                name: name,
                points: 0,
                elo: 1400
              });
              user.save();
            }
            level = level_points.length;
            for (index in level_points) {
              points = level_points[index];
              if (user.points < points) {
                level = index;
                break;
              }
            }
            response.allowance = 0;
            waiting[level].push(response);
            return request.on('close', function() {
              index = waiting[level].indexOf(response);
              if (index !== -1) {
                return waiting[level].splice(index, 1);
              }
            });
          });
        } else {
          level = 1;
          response.allowance = 0;
          waiting[level].push(response);
          return request.on('close', function() {
            var index;
            index = waiting[level].indexOf(response);
            if (index !== -1) {
              return waiting[level].splice(index, 1);
            }
          });
        }
      } else if (u.pathname === '/rooms.js') {
        response.writeHead(200);
        roomsjson = JSON.stringify({
          rooms: (function() {
            var j, len, ref2, results;
            ref2 = Room.all;
            results = [];
            for (j = 0, len = ref2.length; j < len; j++) {
              room = ref2[j];
              if (room.established) {
                results.push({
                  roomid: room.port.toString(),
                  roomname: room.name.split('$', 2)[0],
                  needpass: (room.name.indexOf('$') !== -1).toString(),
                  users: (function() {
                    var k, len1, ref3, results1;
                    ref3 = room.players;
                    results1 = [];
                    for (k = 0, len1 = ref3.length; k < len1; k++) {
                      player = ref3[k];
                      if (player.pos != null) {
                        results1.push({
                          id: (-1).toString(),
                          name: player.name,
                          pos: player.pos
                        });
                      }
                    }
                    return results1;
                  })(),
                  istart: room.started ? 'start' : 'wait'
                });
              }
            }
            return results;
          })()
        });
        return response.end("loadroom( " + roomsjson + " );");
      } else if (u.query === 'operation=getroomjson') {
        response.writeHead(200);
        return response.end(JSON.stringify({
          rooms: (function() {
            var j, len, ref2, results;
            ref2 = Room.all;
            results = [];
            for (j = 0, len = ref2.length; j < len; j++) {
              room = ref2[j];
              if (room.established) {
                results.push({
                  roomid: room.port.toString(),
                  roomname: room.name.split('$', 2)[0],
                  needpass: (room.name.indexOf('$') !== -1).toString(),
                  users: (function() {
                    var k, len1, ref3, results1;
                    ref3 = room.players;
                    results1 = [];
                    for (k = 0, len1 = ref3.length; k < len1; k++) {
                      player = ref3[k];
                      if (player.pos != null) {
                        results1.push({
                          id: (-1).toString(),
                          name: player.name,
                          pos: player.pos
                        });
                      }
                    }
                    return results1;
                  })(),
                  istart: room.started ? "start" : "wait"
                });
              }
            }
            return results;
          })()
        }));
      } else {
        response.writeHead(404);
        return response.end();
      }
    });
    http_server.listen(settings.modules.http.port);

    /*
    setInterval ()->
      for level in [level_points.length..0]
        for index, player of waiting[level]
          opponent_level = null
          opponent = _.find waiting[level], (opponent)->
            log.info opponent,player
            opponent isnt player
          log.info '--------1--------', waiting, opponent
    
          if opponent
            opponent_level = level
          else if player.allowance > 0
            for displacement in [1..player.allowance]
              if level+displacement <= level_points.length
                opponent = waiting[level+displacement][0]
                if opponent
                  opponent_level = level+displacement
                  break
              if level-displacement >= 0
                opponent = waiting[level-displacement][0]
                if opponent
                  opponent_level = level-displacement
                  break
    
          if opponent
            if waiting[level].indexOf(player) == -1 or waiting[opponent_level].indexOf(opponent) == -1
              log.info waiting, player, level, opponent, opponent_level
              throw 'WTF'
            waiting[level].splice(waiting[level].indexOf(player), 1)
            waiting[opponent_level].splice(waiting[opponent_level].indexOf(opponent), 1)
            index--
    
            room = "mycard://#{settings.ip}:#{settings.port}/M##{_.uniqueId()}$#{_.random(999)}"
            log.info 'matched', room
            headers = {"Access-Control-Allow-Origin":"*","Content-Type": "text/plain"}
            player.writeHead(200, headers)
            player.end room
            opponent.writeHead(200, headers)
            opponent.end room
    
          else
            player.allowance++
    
    , 2000
     */
    originIsAllowed = function(origin) {
      return true;
    };
    wsServer = new WebSocketServer({
      httpServer: http_server,
      autoAcceptConnections: false
    });
    wsServer.on("request", function(request) {
      var connection, j, len, ref, room, room_name, stanza;
      if (!originIsAllowed(request.origin)) {
        request.reject();
        console.log((new Date()) + " Connection from origin " + request.origin + " rejected.");
        return;
      }
      room_name = decodeURIComponent(request.resource.slice(1));
      if (room_name === 'started') {
        room = _.find(Room.all, function(room) {
          return room.started;
        });
      } else {
        room = Room.find_by_name(room_name);
      }
      if (!room) {
        request.reject();
        console.log((new Date()) + " Connection from origin " + request.origin + (" rejected. " + room_name));
        return;
      }
      connection = request.accept(null, request.origin);
      console.log((new Date()) + (" Connection accepted. " + room.name));
      room.ws_watchers.push(connection);
      ref = room.watcher_stanzas;
      for (j = 0, len = ref.length; j < len; j++) {
        stanza = ref[j];
        connection.sendBytes(stanza);
      }

      /*
      connection.on "message", (message) ->
        if message.type is "utf8"
          console.log "Received Message: " + message.utf8Data
          connection.sendUTF message.utf8Data
        else if message.type is "binary"
          console.log "Received Binary Message of " + message.binaryData.length + " bytes"
          connection.sendBytes message.binaryData
       */
      return connection.on("close", function(reasonCode, description) {
        var index;
        index = _.indexOf(room.ws_watchers, connection);
        if (index !== -1) {
          room.ws_watchers.splice(index, 1);
        }
        return console.log((new Date()) + " Peer " + connection.remoteAddress + " disconnected.");
      });
    });
  }

  inotify = new Inotify();

  inotify.addWatch({
    path: 'ygocore/replay',
    watch_for: Inotify.IN_CLOSE_WRITE | Inotify.IN_CREATE | Inotify.IN_MODIFY,
    callback: function(event) {
      var mask, port, room;
      mask = event.mask;
      if (event.name) {
        port = parseInt(path.basename(event.name, '.yrp'));
        room = Room.find_by_port(port);
        if (room) {
          if (mask & Inotify.IN_CREATE) {

          } else if (mask & Inotify.IN_CLOSE_WRITE) {
            return fs.unlink(path.join('ygocore/replay'), function(err) {});
          } else if (mask & Inotify.IN_MODIFY) {
            return room.alive = true;
          }
        }
      } else {
        return log.error("event without filename");
      }
    }
  });


  /*
  setInterval ()->
    for room in Room.all
      if room.alive
        room.alive = false
      else
        log.info "kill room", room.port
  
        for player in room.players
          ygopro.stoc_send_chat(player, "由于长时间没有活动被关闭") unless player.closed
        room.process.kill()
  , 900000
   */

}).call(this);
