//var git = require("nodegit");
var git  = require('gift');
var extend = require("extend");
var debug = require('debug')('metalsmith-versioned-posts');
var path = require('path');
var fs = require('fs');
var mkdirp = require("mkdirp");

module.exports = plugin;


/**
 * Metalsmith plugin that converts git repos of posts into public posts with all versions available.
 *
 * @param {Object} options (optional)
 * @return {Function}
 */

var default_options = {
	directories: ["_posts"],
	layout: "_layouts/repo.html",
	filename_matches: [ "draft", "index" ],
	extension_matches: [ "md", "mkd", "markdown", "txt" ],
	extras: [ "repo", "blobs", "commits", "diffs" ],
	override: true
}

function plugin(options){
	options = extend(false, default_options, options || {});

	return function(files, metalsmith, done){
	    setImmediate(done);
		Object.keys(files).forEach(function(file){
			var filename = path.basename(file).split(".")[0].toLowerCase(),
				extension = path.basename(file).split(".")[1],
				directory = path.dirname(file).toLowerCase(),
				directories = directory.split(path.sep);

			// only look in root directories specified by config 
			if (~options.directories.indexOf(directories[0])) {
				// remove any actual git file from Metalsmith's consideration. We're going to look for these later
				if (/\.git/.test(file)) {
					delete files[file];
					return;
				}

				// look for files that are candidates to have a git repo
				if (~options.filename_matches.indexOf(filename) || ~options.extension_matches.indexOf(extension)) {
					debug('checking file: %s for a corresponding git repo', file);
					var pathToRepo = path.join(metalsmith.dir, metalsmith._src, directory),
						pathToGit = path.join(pathToRepo, ".git"),
						hasRepo = fs.existsSync(pathToGit);

					if (hasRepo) {
						debug("Found repo for %s!", file);

						var data = files[file],
							versions = [];
							repo = git(pathToGit);

						// commits are in descending order
						repo.commits(function(err, commits) {
							commits.forEach(function(commit) {
								versions.push({
									id: commit.id,
									date: commit.committed_date,
									committer: {
										name: commit.committer.name,
										email: commit.committer.email
									},
									message: commit.message
								});
							});

							// we'll add a boolean in the metadata for easy template handling
							data.is_repo = true;
							data.slug = (!options.override && data.slug)? data.slug : directories.slice(-1)[0];
							data.date = (!options.override && data.date)? data.date : versions[0].date;
							data.original_date = (!options.override && data.original_date)? data.original_date : versions.slice(-1)[0].date;

							/* extras */

							// commits.json
							var obj = {
					            contents: JSON.stringify(versions, null, 2)							
							}
							files[path.join(directory, "commits.json")] = obj;

							//blobs
							repo.tree().blobs(function(err, blobs) {
								blobs.forEach(function(blob) {
									var datastream = blob.dataStream(),
										datum = "";

									console.log(blob.id, datastream.length);

									datastream[0].on('data', function(buffer) {
										datum += buffer.toString();
									}).on('end', function(buffer) {
										files[path.join(directory, "blobs", blob.id, blob.name)] = datum;
									});
								});
							})
						});



						/*
						git.Repository.open(pathToRepo)
							.then(function(repo) {
								return repo.getMasterCommit();
							})
							.then(function(firstCommitOnMaster) {
						*/
					}
					//if (fs.existsSync(directory + ""))
				}
			}
		});
	};
}

