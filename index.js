var git = require("nodegit");
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

/**
 * Inspired by https://github.com/jsvine/gekyll
 * To output the debug info, you can do this when building: DEBUG=metalsmith-versioned-posts ./path/to/metalsmith/CLI
 */

var default_options = {
	directories: "ALL",	// can specify an array of root directories in which to look for versioned posts. Useful if want to ignore git repos in /src directory, etc.
	filename_matches: [ "draft.md", "article.md" ],	
	extras: [ "repo", "commits", "diffs" ], // need to implement this
	override: true		// whether to override properties like "date" that may be in original metadata
}

function plugin(options){
	options = extend(false, default_options, options || {});

	return function(files, metalsmith, done){
		var repo_count = 0;

		Object.keys(files).forEach(function(file) {
			const filename = path.basename(file).split(".")[0].toLowerCase();
			const extension = path.basename(file).split(".")[1];
			const directory = path.dirname(file).toLowerCase();
			const directories = directory.split(path.sep);

			// only look in root directories specified by config 
			if (options.directories === "ALL" || ~options.directories.indexOf(directories[0])) {
				// remove any actual git files from Metalsmith's consideration (as well as from production). We're going to look for these later
				if (/\.git/.test(file)) {
					delete files[file];
					return;
				}

				// look for files that are candidates to have a git repo, then check if there is a git repo there
				if (~options.filename_matches.indexOf(filename + "." + extension)) {
					debug('checking file: %s for a corresponding git repo', file);
					var pathToRepo = path.join(metalsmith._directory, metalsmith._source, directory),
						pathToGit = path.join(pathToRepo, ".git"),
						hasRepo = fs.existsSync(pathToGit);

					if (hasRepo) {
						repo_count += 1;
						debug("Found repo for %s!", file, repo_count);

						var data = files[file],
							versions = [];

						git.Repository.open(pathToGit)
							.then(function(repo) {
								return repo.getMasterCommit();
							})
							.then(function(firstCommitOnMaster) {
								var history = firstCommitOnMaster.history();

							    history.on("commit", function(commit) {
									versions.push({
										id: commit.sha(),
										date: commit.date(),
										committer: {
											name: commit.author().name(),
											email: commit.author().email()
										},
										message: commit.message().trim()
									});

									// need to figure out diffs and blobs -- nodegit not well documented
									// example here https://github.com/nodegit/nodegit/blob/master/example/diff-commits.js
									/*
									var diffs = [];
									commit.getDiff().then(function(diffList) {										
										diffList.forEach(function(diff) {
										    diff.patches().forEach(function(patch) {
										    	// for now, just getting diffs on the article, not any other source files that may exist in repo
										    	if (path.basename(file) === patch.oldFile().path()) { 
													var diff = {
														path_a: patch.oldFile().path(),
														path_b: patch.newFile().path(),
														hunks: []
													};
													patch.hunks().forEach(function(hunk) {
														var hunk = {
															header: hunk.header().trim(),
															lines: []
														};

												        hunk.lines().forEach(function(line) {
												        	hunk.lines.push(String.fromCharCode(line.origin()) + line.content().trim());
												        });
													    diff.hunks.push(hunk);
												    });
												    diffs.push(diff);
										    	}
											});											
										});										
									}); */
							    });

							    history.on("end", function() {
									// we'll add a boolean in the metadata for easy template handling
									data.is_repo = true;
									data.slug = (!options.override && data.slug)? data.slug : directories.slice(-1)[0];
									data.date = (!options.override && data.date)? data.date : versions[0].date;
									data.original_date = (!options.override && data.original_date)? data.original_date : versions.slice(-1)[0].date;
									data.versions = versions;

									var obj = {
							            contents: JSON.stringify(versions, null, 2)							
									}
									files[path.join(directory, "commits.json")] = obj;

									// basic way to track async behavior. Should be more error tolerant.
									repo_count -= 1;
							    	debug("Done getting commits for", directory, repo_count);
									if (repo_count == 0) {
										done();
									}
							    });

							    // Start emitting events.
							    history.start();
							});
					}
				}
			}
		});

		// we've now scanned each file. If no repos found, we're done.
		if (!repo_count) {
			debug("metalsmith-versioned-posts didn't see any eligible repos.");
			done();		
		}
	};
}

