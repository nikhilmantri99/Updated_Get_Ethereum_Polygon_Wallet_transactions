import Moralis from "moralis/node.js";
import fetch from 'node-fetch';
import AWS from "aws-sdk";
var exports={};

async function find_conversion_rate(ticker1,ticker2,timeline){ // gets price of ticker 1 in terms of ticker 2
    if((ticker1=="ETH" && ticker2=="WETH") || (ticker1=="WETH" && ticker2=="ETH") || ticker1==ticker2){
        return 1;
    }
    //https://api.covalenthq.com/v1/pricing/historical/eth/revv/
    //?quote-currency=USD&format=JSON&from=2021-12-31&to=2021-12-31&key=ckey_c4b9331412914d59845089270d0
    let part1="https://api.covalenthq.com/v1/pricing/historical/";
    let part2=ticker2;
    let part3="/";
    let part4=ticker1;
    let part5="/?quote-currency=USD&format=JSON&from=";
    let part6=timeline.slice(0,10);
    let part7="&to=";
    let part8=part6;
    let part9="&key=ckey_c4b9331412914d59845089270d0";
    let url_complete=part1.concat(part2,part3,part4,part5,part6,part7,part8,part9);
    const ans = await fetch(url_complete).then(response=>{return response.json();});
    //console.log(url_complete);
    //console.log(ans);
    if(ans==null || ans.data==null) return null;
    else{
       return ans.data.prices[0].price; 
    }
}

async function covalent_logs(txn_hash,waddress,NFTfrom,NFTto,chain_name){
    var chain_num;
    if(chain_name=='polygon'){
        chain_num="137";
    }
    else{
        chain_num="1";
    }
    let e1='https://api.covalenthq.com/v1/';
    let e2='/transaction_v2/';
    let part1=e1.concat(chain_num,e2);
    let part2=txn_hash;
    let part3='/?&key=';
    let part4='ckey_c4b9331412914d59845089270d';
    let url_complete=part1.concat(part2,part3,part4);
    const ans = await fetch(url_complete).then(response=>{return response.json();});
    var mainmoney=0,comission=0,i=0;
    if(ans.data!=null && ans.data.items!=null){
        for(i=0;i<ans.data.items[0].log_events.length;i++){
            if(ans.data.items[0].log_events[i].sender_contract_ticker_symbol=="ENS"){
                return [-1];
            }
        }
    }
    if(ans.data!=null && ans.data.items!=null){
        for(i=0;i<ans.data.items[0].log_events.length;i++){
            if( ans.data.items[0].log_events[i].decoded!=null 
                && ans.data.items[0].log_events[i].sender_contract_decimals==18
                && ans.data.items[0].log_events[i].decoded.name=="Transfer"
                && ans.data.items[0].log_events[i].decoded.params!=null 
                && ans.data.items[0].log_events[i].decoded.params[2].value!=null){
                const rate= await find_conversion_rate(ans.data.items[0].log_events[i].sender_contract_ticker_symbol,
                    "ETH",ans.data.items[0].log_events[i].block_signed_at);
                //console.log("Conversion Rate: ",rate," of 1 ",ans.data.items[0].log_events[i].sender_contract_ticker_symbol," to ETH");
                if(ans.data.items[0].log_events[i].decoded.params[1].value==NFTfrom){
                    mainmoney+=rate*parseInt(ans.data.items[0].log_events[i].decoded.params[2].value)/(10**18);
                    if(i+1<ans.data.items[0].log_events.length){
                        if(ans.data.items[0].log_events[i+1].decoded!=null 
                            && ans.data.items[0].log_events[i+1].sender_contract_decimals==18
                            && ans.data.items[0].log_events[i+1].decoded.name=="Transfer"
                            && ans.data.items[0].log_events[i+1].decoded.params[2].value!=null){
                                comission+=rate*parseInt(ans.data.items[0].log_events[i+1].decoded.params[2].value)/(10**18);
                        }
                    }
                    //return [mainmoney,comission];
                }
                else if(ans.data.items[0].log_events[i].decoded.params[0].value==NFTfrom){
                    mainmoney-=rate*parseInt(ans.data.items[0].log_events[i].decoded.params[2].value)/(10**18);
                    comission+=rate*parseInt(ans.data.items[0].log_events[i].decoded.params[2].value)/(10**18);
                }
            }
        }
    }
    if(mainmoney==0 && comission==0) return null;
    else return [mainmoney,comission,"ETH"];
}

async function etherscan_logs(txn_hash,waddress,NFTfrom,NFTto,chain_name){
    let part1= 'https://api.etherscan.io/api?module=account&action=txlistinternal&txhash=';
    let part2=txn_hash;
    let part3='&apikey=';
    let part4='3K72Z6I2T121TAQZ9DY34EF6F9NADKAH87';
    let url_complete=part1.concat(part2,part3,part4);
    const ans = await fetch(url_complete).then(response=>{return response.json();});
    var mainmoney=0,commission=0;
    var count_occurence=0;//useful for bundle
    var count_occurence2=0;
    for(var i=0;i<ans.result.length;i++){
        if(ans.result[i].value!=null){
            if(ans.result[i].to==NFTfrom){
                mainmoney+=parseInt(ans.result[i].value)/(10**18);
                count_occurence++;
                if(i-1>=0){
                    commission+=parseInt(ans.result[i-1].value)/(10**18);
                }
            }
            else if(ans.result[i].from==NFTfrom){
                count_occurence2++;
                mainmoney-=parseInt(ans.result[i].value)/(10**18);
                commission+=parseInt(ans.result[i].value)/(10**18);
            }
        }
    }
    if(mainmoney==0 && commission==0){
        return null;
    }
    else{
        if(count_occurence>0) return [mainmoney/count_occurence,commission/count_occurence,"ETH"];
        else if(count_occurence2>0) return [mainmoney/count_occurence2,commission/count_occurence2,"ETH"];
        else return [mainmoney,commission,"ETH"];
    }
}

async function polygonscan_logs(txn_hash,waddress,NFTfrom,NFTto,chain_name){
    let part1= 'https://api.polygonscan.com/api?module=account&action=txlistinternal&txhash=';
    let part2=txn_hash;
    let part3='&apikey=';
    let part4='KSPP4UMVPIGFV24FEA19RGND8XN9V3D3C3';
    let url_complete=part1.concat(part2,part3,part4);
    //console.log(url_complete);
    const ans = await fetch(url_complete).then(response=>{return response.json();});
    //console.log(ans);
    var mainmoney=0,commission=0;
    var count_occurence=0;//useful for bundle
    var count_occurence2=0;
    for(var i=0;i<ans.result.length;i++){
        if(ans.result[i].value!=null){
            if(ans.result[i].to==NFTfrom){
                mainmoney+=parseInt(ans.result[i].value)/(10**18);
                count_occurence++;
                if(i-1>=0){
                    commission+=parseInt(ans.result[i-1].value)/(10**18);
                }
            }
            else if(ans.result[i].from==NFTfrom){
                count_occurence2++;
                mainmoney-=parseInt(ans.result[i].value)/(10**18);
                commission+=parseInt(ans.result[i].value)/(10**18);
            }
        }
    }
    if(mainmoney==0 && commission==0){
        return null;
    }
    else{
        if(count_occurence>0) return [mainmoney/count_occurence,commission/count_occurence,"MATIC"];
        else if(count_occurence2>0) return [mainmoney/count_occurence2,commission/count_occurence2,"MATIC"];
        else return [mainmoney,commission,"MATIC"];
    }
}


async function value_from_hash(txn_hash,waddress,NFTfrom,NFTto,chain_name){
    const ans1= await covalent_logs(txn_hash,waddress,NFTfrom,NFTto,chain_name);
    if(ans1==[-1]){
        return -1;
    }
    else if(ans1==null && chain_name=="eth"){
        const ans2= await etherscan_logs(txn_hash,waddress,NFTfrom,NFTto,chain_name);
        return ans2;
    }
    else if(ans1==null && chain_name=="polygon"){
        const ans2= await polygonscan_logs(txn_hash,waddress,NFTfrom,NFTto,chain_name);
        return ans2;
    }
    else{
        return ans1;
    }
}

async function return_NFT_transactions(userid,chain_name,waddress){
    AWS.config.update({region:'us-east-1'});
    const dynamoDb = new AWS.DynamoDB.DocumentClient();
    const get_back = {
        TableName: "lambda-api-wallet-transactions-db",
        // 'Key' defines the partition key and sort key of the item to be retrieved
        Key: {
          userId: userid, // The id of the author
          walletId: waddress, // The id of the note from the path
        },
    };
    const newResult = await dynamoDb.get(get_back).promise();
    if(newResult!=null && newResult.Item!=null){
        console.log("exists in the table.");
        return {
            statusCode: 200,
            body: newResult,
        };
    }
    const transcations_list=[];
    const serverUrl = "https://kpvcez1i2tg3.usemoralis.com:2053/server";
    const appId = "viZCI1CZimCj22ZTyFuXudn3g0wUnG2pELzPvdg6";
    Moralis.start({ serverUrl, appId });
    const options = { chain: chain_name, address: waddress, limit: "5"};
    const transfersNFT = await Moralis.Web3API.account.getNFTTransfers(options);
    console.log(transfersNFT);
    console.log("For wallet address:",waddress," ,chain: ",chain_name,"\nFollowing are the NFT Transaction values: ")
    var count=0;
    for(var i=0;i<transfersNFT.result.length;i++){
        //console.log("Hello");
        const value_from_moralis=parseInt(transfersNFT.result[i].value)/(10**18);
        //console.log(transfersNFT.result[i].transaction_hash);
        const value_from_hash_scans=await value_from_hash(transfersNFT.result[i].transaction_hash,waddress,
                                                           transfersNFT.result[i].from_address,transfersNFT.result[i].to_address,chain_name);
        //const value_from_hash_scans=null;
        if(value_from_hash_scans==-1){
            continue;
        }
        //console.log(value_from_moralis,value_from_hash_scans);
        var final_value;
        if(value_from_hash_scans!=null){
            final_value=value_from_hash_scans;
            if(final_value[0]<0){
                let ticker1="ETH";
                if(chain_name=="polygon"){
                    ticker1="MATIC";
                }
                const rate=await find_conversion_rate(ticker1,final_value[2],transfersNFT.result[i].block_timestamp);
                final_value[0]+=rate*value_from_moralis;
            }
        }
        else if(chain_name=="polygon"){
            final_value=[value_from_moralis,0,"MATIC"];
        }
        else{
            final_value=[value_from_moralis,0,"ETH"];
        }
        count++;
        var action;
        var net_value_;
        if(transfersNFT.result[i].from_address==waddress){
            action="Sold";
            net_value_=final_value[0];
            console.log(count,". Sold NFT. Revenue Increases. Value:",final_value[0],final_value[2],". Hash: ",transfersNFT.result[i].transaction_hash);
        }
        else{
            action="Bought";
            net_value_=final_value[0]+final_value[1];
            console.log(count,". Bought NFT. Spending Increases. Value:",final_value[0]+final_value[1],final_value[2],". Hash: ",transfersNFT.result[i].transaction_hash);
        }
        const this_transaction={
            Item:  {
                userId :'1',
                walletId : waddress,
                blockchain_name: chain_name,
                transaction_hash: transfersNFT.result[i].transaction_hash,
                transaction_timestamp: transfersNFT.result[i].block_timestamp,
                tokenaddress : transfersNFT.result[i].token_address,
                tokenid: transfersNFT.result[i].token_id,
                activity: action,
                value: final_value[0],
                value_mp_fees: final_value[1],
                net_value: net_value_,
                gas_price: 0,
                currency_of_transaction: final_value[2],
            }
        };
        transcations_list.push(this_transaction);
    }
    const transactions={
        TableName: "lambda-api-wallet-transactions-db",
        Item: {
            userId :get_back.Key.userId,
            walletId : get_back.Key.walletId,
            transactions: transcations_list,
        }
    }
    try{
        await dynamoDb.put(transactions).promise();
        const response_body = await dynamoDb.get(get_back).promise();
        return {
            statusCode: 200,
            body: response_body,
        };
    }
    catch(e){
        console.log("Error is found....");
        console.log(e);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: e.message }),
        };
    }
}

exports.handler = async function(event, context){
    const wallet = event["queryStringParameters"]['wallet'];
    const userId = event["queryStringParameters"]['userid'];
    var chain_name= event["queryStringParameters"]['chain'];
    if(chain_name==null){
        chain_name="eth";
    }
    const ans= await return_NFT_transactions(userId, chain_name, wallet);
    return ans;
};

const chain_name="eth";
const waddress="0x1b7b44a1eb8d1445c75c54c0c3fb143a51bebf33";
const ans= await return_NFT_transactions("1",chain_name,waddress);
console.log(ans.body.Item.transactions);