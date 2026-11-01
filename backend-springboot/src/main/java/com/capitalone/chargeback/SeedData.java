package com.capitalone.chargeback;
import org.springframework.boot.*;import org.springframework.context.annotation.*;
@Configuration class SeedData {@Bean CommandLineRunner seed(TransactionRepository r){return a->{if(r.count()==0){r.save(new CardTransaction("txn-amazon","Amazon India","2000"));r.save(new CardTransaction("txn-flipkart","Flipkart","5000"));r.save(new CardTransaction("txn-restaurant","Spice Garden Restaurant","800"));r.save(new CardTransaction("txn-timeout","NoReply Electronics","1200"));r.save(new CardTransaction("txn-rejected","Subscription Streaming","499"));}};}}
