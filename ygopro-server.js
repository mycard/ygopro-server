// Generated by CoffeeScript 1.9.3
(function() {
  var Room, _, bunyan, debug, dialogues, execFile, fs, heapdump, http, http_server, log, net, os, path, request, settings, tips, url, ygopro;

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

  request = require('request');

  bunyan = require('bunyan');

  heapdump = require('heapdump');

  settings = require('./config.json');

  ygopro = require('./ygopro.js');

  Room = require('./room.js');

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


  /*
  #定时清理关闭的连接
  Graveyard = [] 
  
  send_to_graveyard = (socket) ->
    unless _.indexOf(Graveyard, socket)
      Graveyard.push(socket)
  
  tribute = (socket) ->
    setTimeout send_to_graveyard(socket), 30000
  
  setInterval ()->
    log.info Graveyard
  , 30000
   */

  net.createServer(function(client) {
    var ctos_buffer, ctos_message_length, ctos_proto, server, stoc_buffer, stoc_message_length, stoc_proto;
    server = new net.Socket();
    client.server = server;
    client.setTimeout(300000);
    client.on('close', function(had_error) {
      if (!client.closed) {
        client.closed = true;
        if (client.room) {
          client.room.disconnect(client);
        }
      }
      return server.end();
    });
    client.on('error', function(error) {
      if (!client.closed) {
        client.closed = error;
        if (client.room) {
          client.room.disconnect(client, error);
        }
      }
      return server.end();
    });
    client.on('timeout', function() {
      return server.end();
    });
    server.on('close', function(had_error) {
      if (!server.closed) {
        server.closed = true;
      }
      if (!client.closed) {
        ygopro.stoc_send_chat(client, "服务器关闭了连接");
        return client.end();
      }
    });
    server.on('error', function(error) {
      server.closed = error;
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
    server.on('data', function(data) {
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
    return 0;
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
    } else if ((os.freemem() / os.totalmem()) <= 0.1) {
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
    if ((os.freemem() / os.totalmem()) <= 0.1) {
      ygopro.stoc_send_chat(client, "服务器已经爆满，随时存在崩溃风险！");
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
      watcher.on('data', function(data) {
        var j, len, ref, results, w;
        client.room.watcher_buffers.push(data);
        ref = client.room.watchers;
        results = [];
        for (j = 0, len = ref.length; j < len; j++) {
          w = ref[j];
          if (w) {
            results.push(w.write(data));
          } else {
            results.push(void 0);
          }
        }
        return results;
      });
      return watcher.on('error', function(error) {});
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
      return tips = body;
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
        if (player.pos !== 7) {
          client.room.dueling_players[player.pos] = player;
        }
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
              return ygopro.stoc_send_chat_to_room(client.room, stdout);
            }
          }
        });
      case '/help':
        ygopro.stoc_send_chat(client, "YGOSrv233 指令帮助");
        ygopro.stoc_send_chat(client, "/help 显示这个帮助信息");
        if (settings.modules.tips) {
          return ygopro.stoc_send_chat(client, "/tip 显示一条提示");
        }
        break;
      case '/tip':
        if (settings.modules.tips) {
          return ygopro.stoc_send_random_tip(client);
        }
    }
  });

  ygopro.ctos_follow('UPDATE_DECK', false, function(buffer, info, client, server) {
    var i, main, side;
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


  /*
  if settings.modules.skip_empty_side
    ygopro.stoc_follow 'CHANGE_SIDE', false, (buffer, info, client, server)->
      if client.side
        ygopro.ctos_send server, 'UPDATE_DECK', {
          mainc: client.main.length,
          sidec: 0,
          deckbuf: client.main
        }
        ygopro.stoc_send_chat client, '等待更换副卡组中...'
   */

  if (settings.modules.http) {
    http_server = http.createServer(function(request, response) {
      var j, len, player, ref, room, roomsjson, u;
      u = url.parse(request.url, 1);
      if (u.pathname === '/count.json') {
        response.writeHead(200);
        return response.end(Room.all.length.toString());
      } else if (u.pathname === '/rooms.js') {
        response.writeHead(200);
        roomsjson = JSON.stringify({
          rooms: (function() {
            var j, len, ref, results;
            ref = Room.all;
            results = [];
            for (j = 0, len = ref.length; j < len; j++) {
              room = ref[j];
              if (room.established) {
                results.push({
                  roomid: room.port.toString(),
                  roomname: room.name.split('$', 2)[0],
                  needpass: (room.name.indexOf('$') !== -1).toString(),
                  users: (function() {
                    var k, len1, ref1, results1;
                    ref1 = room.players;
                    results1 = [];
                    for (k = 0, len1 = ref1.length; k < len1; k++) {
                      player = ref1[k];
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
      } else if (u.query.operation === 'getroomjson') {
        response.writeHead(200);
        return response.end(JSON.stringify({
          rooms: (function() {
            var j, len, ref, results;
            ref = Room.all;
            results = [];
            for (j = 0, len = ref.length; j < len; j++) {
              room = ref[j];
              if (room.established) {
                results.push({
                  roomid: room.port.toString(),
                  roomname: room.name.split('$', 2)[0],
                  needpass: (room.name.indexOf('$') !== -1).toString(),
                  users: (function() {
                    var k, len1, ref1, results1;
                    ref1 = room.players;
                    results1 = [];
                    for (k = 0, len1 = ref1.length; k < len1; k++) {
                      player = ref1[k];
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
      } else if (u.query.pass === settings.modules.http.password && u.query.shout) {
        ref = Room.all;
        for (j = 0, len = ref.length; j < len; j++) {
          room = ref[j];
          ygopro.stoc_send_chat_to_room(room, u.query.shout);
        }
        response.writeHead(200);
        return response.end("shout " + u.query.shout + " ok");
      } else {
        response.writeHead(404);
        return response.end();
      }
    });
    http_server.listen(settings.modules.http.port);
  }

}).call(this);
