package com.capitalone.chargeback;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class SeedData {
    @Bean
    CommandLineRunner seed(TransactionRepository repository) {
        return args -> {
            if (repository.count() == 0) {
                repository.save(new CardTransaction("txn-amazon", "Amazon India", "2000"));
                repository.save(new CardTransaction("txn-flipkart", "Flipkart", "5000"));
                repository.save(new CardTransaction(
                        "txn-restaurant", "Spice Garden Restaurant", "800"));
                repository.save(new CardTransaction(
                        "txn-timeout", "NoReply Electronics", "1200"));
                var ineligible = new CardTransaction(
                        "txn-rejected", "Subscription Streaming", "499");
                ineligible.eligibleForDispute = false;
                repository.save(ineligible);
            }
        };
    }
}
