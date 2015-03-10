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
  this.startedPlaying = false;
}

var p = client.prototype = new EventEmitter();

p.reserve = function() {

  return this.keeper.reserve()
  .then( function( room ) {

    updateRoom.call( this, room );
    
    return room.setRoomData( {

      paused: true,
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

  if( room && room.roomData.paused ) {

    if( !this.startedPlaying ) {

      this.startedPlaying = true;

      room
      .setVar( 'startTime', ntp.serverTime() )
      .then( function() {

        return room.setVar( 'paused', false );
      });
    } else {

      room
      .setVar( 'paused', false );
    }
  } else {

    doPlay.call( this );
  }
};

p.pause = function() {

  var room = this.room;

  if( room && !room.roomData.paused ) {

    room
    .setVar( 'paused', true );
  } else {

    doPause.call( this );
  }
};

p.seek = function( time ) {

  var room = this.room;

  if( room ) {
    
    room.setVar( 'startTime', ntp.serverTime() - time );
  } else {

    doSeek.call( this, time );
  }
};

function doPlay() {
  this.emit( 'play' );
}

function doPause() {
  this.emit( 'pause' );
}

function doSeek( time ) {

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

  this.room.on( 'user', function( info ) {

    if( info.action == 'join' ) {

      this.isAllInitialized = false; 

      this.emit( 'initialized', false ); 
    }
  
    this.emit( 'user', info );
  }.bind( this ));

  this.room.on( 'data', function( data, info ) {

    checkAllInitialized.call( this );

    if( info ) {

      // initialized a user
      switch( info.key ) {

        case 'paused':
          var isPaused = typeof info.value == 'string' ? info.value == 'true' : info.value;

          if( this.startedPlaying ) {

            if( isPaused ) {

              doPause.call( this );
            } else {

              doPlay.call( this );
            }
          } else {

            if( !isPaused ) {

              this.startedPlaying = true;

              doPlay.call( this );
            }
          }
        break;

        case 'startTime':

          var startTime = info.value;

          doSeek.call( this, ntp.serverTime() - startTime );
        break;
      }
    }
  }.bind( this ));
}