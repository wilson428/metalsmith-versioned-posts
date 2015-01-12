metalsmith-versioned-posts
==========================

A metalsmith plugin that converts Git repositories to posts with all versions publicly available.

##Installation

	npm install git+ssh://git@github.com:wilson428/metalsmith-versioned-posts.git

##Usage

Like all plugins, you can either invoke this one through code or configuration:

###Configuration

In your `metalsmith.json` file:

    "metalsmith-versioned-posts": {
      "directories": ["_posts"],
      "override": false
    }

###Code

	//To do

##Options

	`directories`: Only look for version-eligible posts in these directories