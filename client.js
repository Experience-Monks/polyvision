var promise = require( 'bluebird' );
var innkeeper = require( 'innkeeper-socket.io/client' );
var raf = require( 'raf' );
var EventEmitter = require( 'events' ).EventEmitter;

var SAMPLE_DURATION = 1000;

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
  this.room = null;
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

  var room = this.room;

  return room && room.roomData.startTime !== undefined && room.roomData.startTime != -1;
};

p.getIsPaused = function() {

  var room = this.room;
  return !room || room.roomData.pauseTime != -1; 
};

p.getTime = function() {

  var room = this.room;
  var roomData = room.roomData;
  var time;

  if( roomData.startTime && roomData.startTime > -1 ) {
    time = this.getServerTime() - roomData.startTime;
  } else {
    time = 0;
  }

  return time;
};

p.getServerTime = function() {

  return ntp.serverTime();
};

p.setIsInitialized = function() {

  var room = this.room;

  if( room ) {

    room.setVar( 'pv_init' + this.io.id, true );
  } else {

    throw new Error( 'You\'re not in a room' );
  }
};

p.play = function() {

  var room = this.room;
  var roomData = room.roomData;
  var pauseValue = roomData.pauseTime;
  var pauseTime = typeof pauseValue == 'string' ? parseInt( pauseValue ) : pauseValue;
  var startTime = roomData.startTime;
  var startOffset;

  if( this.getIsPaused() ) {

    if( !this.getHasStartedPlaying() ) {

      room
      .setVar( 'startTime', ntp.serverTime() )
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

  var room = this.room;

  if( !this.getIsPaused() ) {

    room
    .setVar( 'pauseTime', ntp.serverTime() );
  } else {

    emitPause.call( this );
  }
};

p.seek = function( time ) {

  var room = this.room;

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

  var users = this.room.users;
  var data = this.room.roomData;
  var isAllInited = true;

  users.forEach( function( user ) {

    isAllInited = data[ 'pv_init' + user ] && isAllInited;
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

  this.room = room;

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