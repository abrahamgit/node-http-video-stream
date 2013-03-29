/*

	A video transcoding stream which converts an 
	input video from one format/quality/etc into
	another using FFMPEG.

	Is smart in a few ways:

		*	Does not transcode if there are no 
			output streams being piped to, and
			frees memory by destroying the
			FFMPEG object when not in use.

		*	Automatically pauses and resumes
			the transcoding process as streams
			being piped to are added/removed

*/

var stream 		= require('stream'),
	ffmpeg 		= require('/home/seannicholls/projects/github/node-fluent-ffmpeg'),
	util		= require('util');

function FfmpegTranscodeStream(options, config) {

	if (!(this instanceof FfmpegTranscodeStream))
		return new FfmpegTranscodeStream(options);
	stream.Transform.call(this, options);

	var self			= this;
	this.super 			= stream.Transform;

	// inherit from transform stream class
	util.inherits(this, this.super);

	this.clientCount 	= 0;									// number of output streams being piped to
	this.transcoder 	= null;									// FFMPEG object
	this.preset 		= null;									// FFMPEG preset object

	this.realtime		= true;									// enable/disable stream pausing when buffer is full.
																// this does not prevent pausing when there are no
																// output streams!

	this.config 		=  { 	source: 	'',					// FFMPEG settings
								priority: 	10,
								nolog: 		false,
								timeout: 	-1 		};

	this.applyConfigDelta = function(config) {
		var	in_keys = Object.keys(config),
			def_keys = Object.keys(this.config);
		for(var i=0; i<in_keys.length; i++) {
			for(var j=0; j<def_keys.length; j++) {
				if(in_keys[i] == def_keys[j]) {
					this.config[in_keys[i]] = config[in_keys[i]];
				}
			}
		}
		return this.config;
	}

	// apply new configuration
	if(config) {
		this.applyConfigDelta(config);
		console.log(this.config);
	}

	this.pause = function() {
		if(this.clientCount <= 0) {
			if(this.transcoder) {
				this.transcoder.stop();
			}
			this.transcoder = null;	
			this.super.call(this, 'pause');
			console.log('pause');
			this.emit('transcode_stop');
		}
	}

	this.resume = function() {
		if(this.clientCount > 0 && !this.transcoder) {

			// create FFMPEG object
			this.transcoder = new ffmpeg(this.config);
			this.transcoder = this.preset(this.transcoder);

			// start the process	
			this.transcoder.writeToStream(this, function(retcode, error){
				if(error) {
					console.log(error);
					// TODO: 	optional silence
					//			throw exception
				}
			});

			// resume the stream
			this.super.call(this, 'resume');
			console.log('resume');
			this.emit('transcode_start');
		}
	}

	this.pipe = function(dest) {
		this.super.call(this, 'pipe', dest);
		console.log('pipe');
		this.clientCount++;
		this.resume();

		// automatically unpipe when destination
		// emits either 'end' or 'close' events
		var cleanup = function() {
			self.unpipe(dest);
			console.log('cleanup > unpipe');
		}
		dest.on('close', cleanup);
		dest.on('end', cleanup);
	}

	this.unpipe = function(dest) {
		this.super.call(this, 'unpipe', dest);
		console.log('unpipe');
		this.clientCount--;
		this.pause();
	}

	this._transform = function(chunk, encoding, done) {
		process.stdout.write('.');	// DEBUG
		this.push(chunk);
		done();
	}
/*
	this._write = function(chunk, encoding, cb) {

		// out with the old
		if(this.realtime && this.buffer) {
			if((chunk.length + this.buffer.length) > this.highWaterMark) {
				this.buffer = this.buffer.slice(chunk.length, this.buffer.length - chunk.length)
			}
		}

		// in with the new
		this.super.call(this, '_write', chunk, encoding, cb);

	}
*/
}
util.inherits(FfmpegTranscodeStream, stream.Transform);

module.exports = FfmpegTranscodeStream;