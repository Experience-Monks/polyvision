# polyvision

[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

Create multi user experiences which are controlled by time. Built on top of `socket.io` and `innkeeper`.

## Usage

[![NPM](https://nodei.co/npm/polyvision.png)](https://www.npmjs.com/package/polyvision)

There are two parts to polyvision. A server and a client.

Server Usage:
```javascript
var app = require( 'http' ).createServer( function() {} );
var io = require( 'socket.io' )( app );
var polyvision = require( 'polyvision' );

app.listen( 3333 );

polyvision( io );
```

Client Usage:
```javascript
var io = require( 'socket.io-client' );
var polyvision = require( 'polyvision/client' );

var socket = io( 'http://localhost:3333' );

polyvision( socket )
.then( function( client ) {

    // a user entered
    client.on( 'user', function( info ) {

      console.log( 'users', info.users );
    });

    // the experience should start playing
    client.on( 'play', function() {

      console.log( 'playing' );
    });

    // the experience should be paused
    client.on( 'pause', function() {

        console.log('paused');
    });

    function join(id) {
        client.enter(id);
    }
});
```

## Client API

### client.room

This is an [`innkeeper`](https://www.npmjs.com/package/innkeeper-socket.io) client room. You can use the room to reserve a key read it's id etc. Room's are places where users will all join and then have the ability to set room data. One polyvision client can have one room.

### `client.reserve()`

Returns a promise which will return a reference to the polyivision client when a room has been reserved. 

### `client.enter(id)`

Returns a promise which will return a reference to the polyivision client when a room has been entered. `id` is an room id.

### `client.enterKey(key)`

Returns a promise which will return a reference to the polyivision client when a room has been entered. `key` is an room id.

### `client.getHasStartedPlaying()`

Returns `true` or `false` depending whether a polyvision experience has started playing.

### `client.getIsPaused()`

Returns `true` or `false` depending whether a polyvision experience is paused.

### `client.getTime()`

Returns a `Number` that is the number of milliseconds since the experience started. -1 will be returned if the experience has not started.

### `client.getServerTime()`

Returns a `Number` is the servers current time. This can be used to sync actions.

### `client.setVar(key, value)`

Set a variable on the room that everyone can access. `key` is the name of the variable. `value` is the name of the variable. A promise is returned which will resolve once the variable has been set.

### `client.getVar(key)`

Get a variable on the room. `key` is the name of the variable. A promise is returned which will return the variables value when it resolves.

### `client.play()`

Start the experience by calling play. Calling play will notify everyone whose joined the room that the experience has started. After play has been called calling the time of the experience will begin incrementing. In order to ensure that all clients start the experience at the exact same time `client.getTime()` will return -1 for one second.

### `client.pause()`

Pause the experience.

### `client.seek(time)`

Seek the experience to another time. This should not be called until the experience has truly started after that one second delay which is mentioned in `client.play`




## License

MIT, see [LICENSE.md](http://github.com/jam3/polyvision/blob/master/LICENSE.md) for details.
