# hello:

do you want an easiy way to make a server and then just add a bunch of micro services
and modify the front-end to your liking.

this project provide the ability to do that,

and on the top of that its SVELTE and TYPESCRIPT yay.



# So lets talk about the tree of this project:

## config folder:

holds all configuration that is generaly used. and any plugin can access it.


## plugins folder:

holds all the plugins, and each plugin has his own homesweethome if he wants a space to work with

## Server folder:

it holds the server and how each plugin is being called (i'm still working on it sooo its a bit hard tbh).

## front-end/src:

this is where you do your front-end magic

## front-end/public:

this is where it outputs the bundle.js and you gotta make the index.html for each page (still working on it)




# How do i run it with the default plugin:

All you have to do is 
go to google captcha and create a project
then get the site token and the key
make a new `.env` file and use `.env.example` as refrences


then just run the command: `npm run server`

`npm run server-dev`: for typescript compiling
`npm run f-dev`: for front-end compiling







# how do i get started:

## First:

add the plugin or use npm i to do so

## Second:

in the server/src/index.ts

get the plugin and make a new object of it
with the settings that you want to use with it.
within the loop with adding casing the name
then just use 
```js
server.use("the plugin here","the plugin config file", "global settings")
```










# config/extention.json avaliable example:

```json
{
    "base":"/",

    "front_end_div_dir":"front-end/src",
    "front_end_out_dir":"front-end/public",

    "plugins": [
        {
            "maindir": "compiler",
            "input": {
                "file": "main.ts"
            },
            "output": {
                "file": "./js/bundle.js"
            },
            "config": {}
        }
    ]
}
```
