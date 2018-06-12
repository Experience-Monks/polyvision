var promise = require( 'bluebird' );
var innkeeper = require( 'innkeeper-socket.io/client' );
var raf = require( 'raf' );
var EventEmitter = require( 'events' ).EventEmitter;

// duration to sample ntp time before we have an accurate value
var SAMPLE_DURATION = 1000;
// duration to delay play call
var INITIAL_PLAY_OFF = 1000;
// this boolean is for whether ntpm time has been initialize
var isInitialized = false;

// this will create a global for ntp
require( 'socket-ntp-krcmod/client/ntp' );

module.exports = function( io ) {

  return new promise( function( resolve, reject ) {

    if( isInitialized ) {

      resolve( client( io ) );
    } else {

      var startTime = Date.now();

      var checkTime = function() {

        isInitialized = io.id &&
                        Date.now() - startTime < SAMPLE_DURATION ||
                        isNaN( ntp.serverTime() );

        if( !isInitialized ) {

          resolve( client( io ) );
        } else {

          raf( checkTime );
        }
      };

      ntp.init( io );

      checkTime();
    }
  });
};

function client( io ) {

  if( !( this instanceof client ) ) {

    return new client( io );
  }

  this.io = io;
  this.keeper = innkeeper( { io: io } );
  this._room = null;
  this.isAllInitialized = false;
}

var p = client.prototype = new EventEmitter();

p.reserve = function() {

  return this.keeper.reserve()
  .then( function( room ) {

    updateRoom.call( this, room );
    
    return room.setRoomData( {

      startTime: -1
    });
  }.bind( this ))
  .then( function() {

    return this;
  }.bind( this ));
};

p.enter = function( id ) {

  return this.keeper.enter( id )
  .then( function( room ) {

    updateRoom.call( this, room );
    
    return this;
  }.bind( this ));
};

p.enterKey = function( key ) {

  return this.keeper.enterWithKey( key )
  .then( function( room ) {

    updateRoom.call( this, room );

    return this;
  }.bind( this ));
};

p.getHasStartedPlaying = function() {

  var roomData = this.getRoomData();

  return roomData.startTime !== undefined && roomData.startTime != -1;
};

p.getIsPaused = function() {

  var roomData = this.getRoomData();

  return roomData.pauseTime != -1; 
};

p.getTime = function() {

  var roomData = this.getRoomData();
  var time;

  if( roomData.startTime && roomData.startTime > -1 ) {
    time = this.getServerTime() - roomData.startTime;
  } else {
    time = -1;
  }

  return time;
};

p.getServerTime = function() {

  return ntp.serverTime();
};

p.setVar = function( key, value ) {

  return this.getRoom()
  .setVar( key, value );
};

p.getVar = function( key ) {

  return this.getRoomData()[ key ];
};

p.getUsers = function() {

  return this.getRoom().users;
};

p.getMyUserIdx = function() {

  var users = this.getUsers();
  var idx = -1;

  for(var i = 0; i < users.length; i++) {

    // added in /# because it seems that socket.io-client adds /# to the id
    // where on the backend socket.id does not have /#
    if(users[ i ] === '/#' + this.io.id) {
      idx = i;
      break;
    }
  }

  return idx;
};

p.getRoom = function() {
  if(this._room) {
    return this._room;
  } else {
    throw new Error('To perform this action you must be in a room first');
  }
};

p.getRoomData = function() {

  return this.getRoom().roomData;
};

p.setIsInitialized = function() {

  // added in /# because it seems that socket.io-client adds /# to the id
  // where on the backend socket.id does not have /#
  var room = this.getRoom().setVar( 'pv_init/#' + this.io.id, true );
};

p.play = function() {

  var room = this.getRoom();
  var pauseValue = this.getVar( 'pauseTime' );
  var pauseTime = typeof pauseValue == 'string' ? parseInt( pauseValue ) : pauseValue;
  var startTime = this.getVar( 'startTime' );
  var startOffset;

  if( this.getIsPaused() ) {

    if( !this.getHasStartedPlaying() ) {

      room
      .setVar( 'startTime', ntp.serverTime() + INITIAL_PLAY_OFF )
      .then( function() {

        return room.setVar( 'pauseTime', -1 );
      });
    } else {

      startOffset = ( ntp.serverTime() - pauseTime );

      room
      .setVar( 'startTime', startTime + startOffset )
      .then( function() {

        return room.setVar( 'pauseTime', -1 );
      });
    }
  } else {

    emitPlay.call( this );
  }
};

p.pause = function() {

  var room = this.getRoom();

  if( !this.getIsPaused() ) {

    room
    .setVar( 'pauseTime', ntp.serverTime() );
  } else {

    emitPause.call( this );
  }
};

p.seek = function( time ) {

  var room = this.getRoom();

  if( room ) {
    
    room.setVar( 'startTime', ntp.serverTime() - time );
  } else {

    emitSeek.call( this, time );
  }
};

function emitPlay() {
  this.emit( 'play' );
}

function emitPause() {
  this.emit( 'pause' );
}

function emitSeek( time ) {

  this.emit( 'seek', time );
}

function checkAllInitialized() {

  var users = this.getUsers();
  var data = this.getRoomData();
  var isAllInited = true;

  users.forEach( function( user ) {

    isAllInited = Boolean(data[ 'pv_init/#' + user ]) && isAllInited;
  });

  if( this.isAllInitialized !== isAllInited ) {

    this.isAllInitialized = isAllInited;

    // all have initialized emit an event
    if( isAllInited ) {

      this.emit( 'initialized', true );
    }  
  }
}

function updateRoom( room ) {

  this._room = room;

  room.on( 'user', function( info ) {

    if( info.action == 'join' ) {

      this.isAllInitialized = false; 

      this.emit( 'initialized', false ); 
    }
  
    this.emit( 'user', info );
  }.bind( this ));

  room.on( 'data', function( data, info ) {

    checkAllInitialized.call( this );

    if( info ) {

      // initialized a user
      switch( info.key ) {

        case 'startTime':

          var startTime = info.value;

          emitSeek.call( this, ntp.serverTime() - startTime );
        break;

        case 'pauseTime':
          var pauseTime = typeof info.value == 'string' ? parseInt( info.value ) : info.value;
          var isPaused = pauseTime != -1;

          if( isPaused ) {

            emitPause.call( this );
          } else {

            emitPlay.call( this );
          }
        break;
      }
    }
  }.bind( this ));
}
