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

function VideoTranscodeStream(options) {
	if (!(this instanceof VideoTranscodeStream))
		return new VideoTranscodeStream(options);
	stream.Transform.call(this, options);
}

VideoTranscodeStream.prototype = Object.create(
  stream.Transform.prototype, { constructor: { value: VideoTranscodeStream }});

VideoTranscodeStream.prototype.transcoder 	= null;									// FFMPEG object
VideoTranscodeStream.prototype.config 		= { 	source: '/dev/video0',			// FFMPEG settings
													priority: 10,
													nolog: true,
													timeout: -1 };
VideoTranscodeStream.prototype.preset 		= null;									// FFMPEG preset object
VideoTranscodeStream.prototype.clientCount 	= 0;

VideoTranscodeStream.prototype._transform = function(chunk, encoding, done) {
	process.stdout.write('.');	// DEBUG
	this.push(chunk);
	done();
};

VideoTranscodeStream.prototype.super = function() {
	this.pause = this.pause;
	this.resume = this.resume;
}

VideoTranscodeStream.prototype.pause = function() {
	if(this.clientCount <= 0) {
		if(this.transcoder) {
			this.transcoder.stop();
		}
		this.transcoder = null;	
		this.super.pause();
	}
}

VideoTranscodeStream.prototype.resume = function() {
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
		this.super.resume();
	}
}

VideoTranscodeStream.prototype.pipe = function(dest) {
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

VideoTranscodeStream.prototype.unpipe = function(dest) {
	this.super.unpipe(dest);
	this.clientCount--;
	this.pause();
}

module.exports = VideoTranscodeStream;