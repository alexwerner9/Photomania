console.log("Running");

var express = require("express");
var cors = require("cors");
const aws = require("aws-sdk");

const S3_BUCKET = process.env.S3_BUCKET;
aws.config.region = 'us-west-2';

var counter = 0;
var total_votes = 0;
var hits = 0;

//Same order
var username_list = [];
var imgURL_list = [];

//Same order
var rated_images = [];
var ratings = [[]];

var average_ratings = [];

express()
    .use('/public',express.static(__dirname + '/public'))
    .use(cors())
    .use(express.json())
    .use(express.urlencoded())
    .set('views', __dirname)
    .set('view engine', 'ejs')
    .get('/photomania', function(req, res) {
        res.render('public/views/account.ejs');
        hits++;
        console.log(`Hits: ${hits}`);
    })
    .get('/sign-s3', (req, res) => {

        const listParams = {
            Bucket: S3_BUCKET
        }

        const s3 = new aws.S3();
        var fileName = "default_name";
        var count = 0;

        //Get amount of items in bucket with AWS S3 API
        s3.listObjects(listParams, function(err,data) {
            if(err) {
                console.log('List error: ' + err);
                fileName = 'err';
            } else {
                console.log(data.Contents.length);
                count = parseInt(data.Contents.length);
                fileName = `image${count}`
                counter = count;
                
                const fileType = req.query['file-type'];
                const username = req.query['username'];

                const s3Params = {
                Bucket: S3_BUCKET,
                Key: fileName,
                Expires: 60,
                ContentType: fileType,
                ACL: 'public-read'
                }
            
                s3.getSignedUrl('putObject', s3Params, (err, data) => {
                    if(err){
                        console.log('Signed error: ' + err);
                        return res.end();
                    }
                    const returnData = {
                        signedRequest: data,
                        url: `https://${S3_BUCKET}.s3.amazonaws.com/${fileName}`
                    };
                    imgURL_list.push(`https://reddit-photo-contest.s3.us-west-2.amazonaws.com/${fileName}`);
                    if(username) {
                        username_list.push(username);
                    } else {
                        username_list.push('Anonymous');
                    }
                    res.write(JSON.stringify(returnData));
                    res.end();
                });

            }
      });
    })
    .get("/photomania-submitted", function(req,res) {
        res.render('public/views/submitted.ejs');
    })
    .get("/get-photo-url", function(req,res) {

        var randInt = Math.floor(Math.random() * (counter));
        var photoURL = "https://reddit-photo-contest.s3.us-west-2.amazonaws.com/image" + randInt;
        
        var params = {
            'photoURL':photoURL,
            'username':username_list[randInt]
        }
        
        res.write(JSON.stringify(params));
        res.end();

    })
    .post("/submit-rating", function(req,res) {
        total_votes++;
        console.log(`Vote count: ${total_votes}`)

        //If image has no ratings yet, add to list of rated images
        if(rated_images.indexOf(req.body.photoURL) === -1) {
            rated_images.push(req.body.photoURL);
        }

        //If image has no ratings, initialize the rating array
        if(!ratings[rated_images.indexOf(req.body.photoURL)]) {
            ratings[rated_images.indexOf(req.body.photoURL)] = [];
        }

        //Push rating to ratings array at corresponding index of the rated image rated_images
        ratings[rated_images.indexOf(req.body.photoURL)].push(req.body.rating);

        res.sendStatus(200);
        res.end();
    })
    .get("/end-contest" + process.env.ADMIN_KEY, function(req,res) {
        average_ratings = [];
        var average = 0;
        for(var i = 0; i < rated_images.length; i++) {
            for(var j = 0; j < ratings[i].length; j++) {
                average += parseInt(ratings[i][j]);
            }
            average_ratings.push(average/ratings[i].length);
            average = 0;
        }
        console.log(average_ratings);

        var highest = 0;
        var highestLocale = 0;
        for(var i = 0; i < average_ratings.length; i++) {
            if(average_ratings[i] > highest) {
                highest = average_ratings[i];
                highestLocale = i;
            }
        }
        var winner = username_list[imgURL_list.indexOf(rated_images[highestLocale])];

        console.log(`Winner: ${winner}`);
        res.send(winner);
    })
    .get('/display-results' + process.env.ADMIN_KEY, function(req,res) {
        var curr_average_ratings = [];

        var average = 0;
        for(var i = 0; i < rated_images.length; i++) {
            for(var j = 0; j < ratings[i].length; j++) {
                average += parseInt(ratings[i][j]);
            }
            curr_average_ratings.push(average/ratings[i].length);
            average = 0;
        }

        for(var i = 0; i < username_list.length; i++) {
            var tUsername = username_list[i];
            var img = imgURL_list[i];
            var ave = curr_average_ratings[rated_images.indexOf(img)];

            if(!ave) {
                ave = "No votes yet";
            }
            console.log(`${tUsername}: ${ave}. Img: ${img}`);
        }

        res.write("Please check console");
        res.end();
    })
    .get('/reset-cookies' + process.env.ADMIN_KEY, function(req,res) {
        res.render('public/views/cookies.ejs');
    })
    .listen(process.env.PORT || 80, () => console.log('Listening'));