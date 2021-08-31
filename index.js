console.log("Running");

var express = require("express");
var cors = require("cors");
const fs = require("fs");
const aws = require("aws-sdk");

const S3_BUCKET = process.env.S3_BUCKET;
aws.config.region = 'us-west-2';

var counter = 0;
var hits = 0;

//Same order
var username_list = [];
var imgURL_list = [];

//Same order
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

                //Set uploading params
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
                    ACL: 'public-read',
                    Metadata: {
                        user:username
                    }
                }
            
                //Get signed URL to send to client to upload
                s3.getSignedUrl('putObject', s3Params, (err, data) => {
                    if(err){
                        console.log('Signed error: ' + err);
                        return res.end();
                    }

                    const returnData = {
                        signedRequest: data,
                        url: `https://${S3_BUCKET}.s3.amazonaws.com/${fileName}`
                    };

                    //Get username list from username list stored in S3
                    s3.getObject({Bucket:S3_BUCKET, Key:'usernames'}, function(err,data) {

                        if(err) {
                            console.log("Get error: " + err);
                            username_list = [];

                            //Update username_list
                            if(username) {
                                username_list.push(username);
                            } else {
                                username_list.push('Anonymous');
                            }

                            //Write local version
                            fs.writeFileSync("usernames.txt", JSON.stringify(username_list));

                            //Upload to S3
                            uploadToS3('usernames.txt', s3, 'usernames');

                        } else {
                            username_list = JSON.parse(String.fromCharCode.apply(null,data.Body));
                            console.log("username_list updated from s3");

                            //Update username_list
                            if(username) {
                                username_list.push(username);
                            } else {
                                username_list.push('Anonymous');
                            }

                            //Write local version
                            fs.writeFileSync("usernames.txt", JSON.stringify(username_list));

                            uploadToS3('usernames.txt', s3, 'usernames');

                        }

                    });

                    //Get img URL list from img URL list stored in S3
                    s3.getObject({Bucket:S3_BUCKET, Key:'imgURLs'}, function(err,data) {

                        if(err) {
                            console.log("Get error: " + err);
                            imgURL_list = [];

                            //Update imgURL_list
                            imgURL_list.push(`https://reddit-photo-contest.s3.us-west-2.amazonaws.com/${fileName}`);
                            
                            //Rewrite local file
                            fs.writeFileSync("imgURLs.txt", JSON.stringify(imgURL_list));

                            uploadToS3('imgURLs.txt', s3, 'imgURLs');

                        } else {
                            imgURL_list = JSON.parse(String.fromCharCode.apply(null,data.Body));
                            console.log("imgURL updated from s3");
                            
                            //Update imgURL_list
                            imgURL_list.push(`https://reddit-photo-contest.s3.us-west-2.amazonaws.com/${fileName}`);
                            
                            //Rewrite local file
                            fs.writeFileSync("imgURLs.txt", JSON.stringify(imgURL_list));

                            uploadToS3('imgURLs.txt', s3, 'imgURLs');

                        }

                    });

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

        var randInt = Math.floor(Math.random() * (imgURL_list.length));
        photoURL = imgURL_list[randInt];

        var params = {
            'photoURL':photoURL,
            'username':username_list[randInt]
        }
        
        res.write(JSON.stringify(params));
        res.end();

    })
    .post("/submit-rating", function(req,res) {

        //TODO add ratings to temp object, then upload at interval

        //PULL RATING LIST FROM S3 AND CONVERT TO JSON
        const s3 = new aws.S3();
        s3.getObject({Bucket:S3_BUCKET, Key:'ratings'}, function(err,data) {
            if(err) {
                console.log("Ratings err" + err);
                ratings = [[]];

                if(!ratings[imgURL_list.indexOf(req.body.photoURL)]) {
                    console.log("Creating new rating entry at " + imgURL_list.indexOf(req.body.photoURL));
                    ratings[imgURL_list.indexOf(req.body.photoURL)] = [];
                }
                ratings[imgURL_list.indexOf(req.body.photoURL)].push(req.body.rating);
                console.log("Ratings: ");
                console.log(ratings);

                //REWRITE FILE
                fs.writeFileSync("ratings.txt", JSON.stringify(ratings));

                uploadToS3('ratings.txt', s3, 'ratings');

            } else {
                ratings = JSON.parse(String.fromCharCode.apply(null,data.Body));
                console.log("Fetched ratings");

                //GET LOCATION OF IMGURL IN imgURLs_list (local version of s3)
                //PUT RATING IN SAME LOCATION IN THE RATING LIST
                if(!ratings[imgURL_list.indexOf(req.body.photoURL)]) {
                    console.log("Creating new rating entry at " + imgURL_list.indexOf(req.body.photoURL));
                    ratings[imgURL_list.indexOf(req.body.photoURL)] = [];
                }
                ratings[imgURL_list.indexOf(req.body.photoURL)].push(req.body.rating);
                console.log("Ratings: ");
                console.log(ratings);

                //REWRITE FILE
                fs.writeFileSync("ratings.txt", JSON.stringify(ratings));

                uploadToS3('ratings.txt', s3, 'ratings');

            }
        });

        

        res.sendStatus(200);
        res.end();
    })
    .get("/end-contest" + process.env.ADMIN_KEY, function(req,res) {
        average_ratings = [];

        const s3 = new aws.S3();
        s3.getObject({
            Bucket:S3_BUCKET,
            Key:'ratings'
        }, function(err,data) {

            var ave = 0;
            var fetched_ratings = JSON.parse(String.fromCharCode.apply(null,data.Body));
            console.log(JSON.parse(String.fromCharCode.apply(null,data.Body)));
            for(var i = 0; i < fetched_ratings.length; i++) {
                if(fetched_ratings[i]) {
                    for(var j = 0; j < fetched_ratings[i].length; j++) {
                        ave += parseInt(fetched_ratings[i][j]);
                    }
                    ave = (ave / fetched_ratings[i].length);
                    average_ratings.push(ave);
                    ave = 0;
                } else {
                    average_ratings.push(NaN);
                }
            }

        });

        var highest = 0;
        var highestLocale = 0;
        for(var i = 0; i < average_ratings.length; i++) {
            if(average_ratings[i] > highest) {
                highest = average_ratings[i];
                highestLocale = i;
            }
        }
        var winner = username_list[highestLocale];

        console.log(`Winner: ${winner}`);
        res.send(winner);
    })
    .get('/display-results' + process.env.ADMIN_KEY, function(req,res) {

        const s3 = new aws.S3();
        s3.getObject({
            Bucket:S3_BUCKET,
            Key:'ratings'
        }, function(err,data) {

            var ave = 0;
            var fetched_ratings = JSON.parse(String.fromCharCode.apply(null,data.Body));
            console.log(JSON.parse(String.fromCharCode.apply(null,data.Body)));
            for(var i = 0; i < fetched_ratings.length; i++) {
                if(fetched_ratings[i]) {
                    for(var j = 0; j < fetched_ratings[i].length; j++) {
                        ave += parseInt(fetched_ratings[i][j]);
                    }
                    ave = (ave / fetched_ratings[i].length);
                    console.log(`${username_list[i]}: ${ave}`);
                    ave = 0;
                }
            }

        });

        res.write("Please check console");
        res.end();
    })
    .get('/reset-cookies' + process.env.ADMIN_KEY, function(req,res) {
        res.render('public/views/cookies.ejs');
    })
    .listen(process.env.PORT || 80, () => console.log('Listening'));

function uploadToS3(file, s3, key) {

    var fileStream = fs.createReadStream(file);

    s3.upload({
        Bucket:S3_BUCKET,
        Key:key,
        Body:fileStream,
        ACL:'public-read'
    }, function(err,data) {
        if(err) {
            console.log("Upload error: " + err);
        }
    });

}