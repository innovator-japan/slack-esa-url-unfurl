'use strict';

var requestPromise = require('request-promise-native');

exports.handler = (req, context, callback) => {
  try {
    switch (req.type) {
      case "url_verification": callback(null, req.challenge); break;
      case "event_callback": processEvent(req.event, callback); break;
      default: callback(null);
    }
  } catch (err) {
    callback(err);
  }
};

function processEvent(event, callback) {
  const urls = event.links.map(link => link.url);

  Promise.all(
    urls.map(buildUnfurls)
  ).then(function(values) {
    const unfurls = values.reduce(function (map, obj) {
      map[obj.url] = obj.info;
      return map;
    }, {});

    const qs = {
      token: process.env.SLACK_OAUTH_ACCESS_TOKEN,
      channel: event.channel,
      ts: event.message_ts,
      unfurls: JSON.stringify(unfurls)
    };

    return requestPromise({
      url: 'https://slack.com/api/chat.unfurl',
      qs: qs,
      method: 'POST'
    }).then(function (msg) {
      console.log(msg);
    }).catch(function (error) {
      console.log('Error when request Slack Web API chat.unfurls: ' + error);
    });
  });
};

function buildUnfurls(url) {
  const team = process.env.ESA_TEAM_NAME;
  const regexp = new RegExp('^https://' + team + '.esa.io/posts/(\\d+).*$', 'i');
  const matchArr = url.match(regexp);
  const post_number = matchArr ? matchArr[1] : 0;

  const options = {
    url: 'https://api.esa.io/v1/teams/' + team + '/posts/' + post_number,
    method: 'GET',
    qs: {
      access_token: process.env.ESA_ACCESS_TOKEN
    },
    json: true
  };

  return requestPromise(options).then(function(post) {
    const updated_user_name = post.updated_by.screen_name;
    const updated_at = post.updated_at;
    var title = post.full_name;
    if (post.wip) {
      title = '[WIP] ' + title;
    }
    const text = post.body_md.split(/\n/, 10).join("\n");

    return {
      url: url,
      info: {
        title: title,
        title_link: url,
        author_name: post.created_by.screen_name,
        author_icon: post.created_by.icon,
        text: text,
        color: '#3E8E89',
        footer: 'Updated by ' + updated_user_name + ' @' + updated_at
      }
    };
  }).catch(function(error) {
    console.log(error);
  });
}
