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

	if (!(this instanceof VideoTranscodeStream))
		return new VideoTranscodeStream(options);
	stream.Transform.call(this, options);

	this.clientCount 	= 0;									// number of output streams being piped to
	this.transcoder 	= null;									// FFMPEG object
	this.preset 		= null;									// FFMPEG preset object

	this.realtime		= true;									// enable/disable stream pausing when buffer is full.
																// this does not prevent pausing when there are no
																// output streams!

	this.default_config =  { 	source: 	'',					// FFMPEG settings
								priority: 	10,
								nolog: 		true,
								timeout: 	-1 		};

	// apply new configuration
	if(config) {
		this.applyConfigDelta(config);
	}

	this.applyConfigDelta = function(config) {
		var	in_keys = Object.keys(config),
			def_keys = Object.keys(this.default_config);
		for(var i=0; i<keys.length; i++) {
			for(var j=0; j<def_keys.length; j++) {
				if(keys[i] == def_keys[j]) {
					this.config[keys[i]] = config[keys[i]];
				}
			}
		}
		return this.config;
	}

	this.pause = function() {
		if(this.clientCount <= 0) {
			if(this.transcoder) {
				this.transcoder.stop();
			}
			this.transcoder = null;	
			Duplex.prototype.transform.call(this, pause);
		}
	}

	this.resume = function() {
		if(this.clientCount > 0 && !this.transcoder) {

			// create FFMPEG object
			this.transcoder = new ffmpeg(this.config);
			this.transcoder = this.preset(this.transcoder);

			// start the process	
			this.transcoder.writeToStream(videoStream, function(retcode, error){
				if(error) {
					console.log(error);
					// TODO: 	optional silence
					//			throw exception
				}
			});

			// resume the stream
			Duplex.prototype.transform.call(this, resume);
		}
	}

	this.pipe = function(dest) {
		this.super.pipe(dest);
		this.clientCount++;
		this.resume();

		// automatically unpipe when destination
		// emits either 'end' or 'close' events
		var parent = this;
		var cleanup = function() {
			parent.unpipe(dest);
		}
		dest.on('close', cleanup);
		dest.on('end', cleanup);
	}

	this.unpipe = function(dest) {
		this.super.unpipe(dest);
		this.clientCount--;
		this.pause();
	}

	this._transform = function(chunk, encoding, done) {
		process.stdout.write('.');	// DEBUG
		this.push(chunk);
		done();
	}

	this._write = function(chunk, encoding, cb) {

		// out with the old
		if(this.realtime) {
			if((chunk.length + this.buffer.length) > this.highWaterMark) {
				this.buffer = this.buffer.slice(chunk.length, this.buffer.length - chunk.length)
			}
		}

		// in with the new
		Duplex.prototype.transform.call(this, _write, chunk, encoding, cb);

	}

}
util.inherits(FfmpegTranscodeStream, stream.Transform.prototype);

module.exports = FfmpegTranscodeStream;